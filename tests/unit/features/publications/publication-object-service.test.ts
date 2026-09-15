import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicationObjectPlanRequest } from "@/lib/api/schemas/request-publication-ingestion-schemas";
import { PUBLICATION_INGESTION_SERVICE_PRINCIPAL } from "@/lib/auth/service-principal";

const mocks = vi.hoisted(() => {
  const bucket = {
    head: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
  };
  return {
    bucket,
    getBucket: vi.fn<() => typeof bucket | undefined>(() => bucket),
    batchFindUnique: vi.fn(),
    batchObjectFindFirst: vi.fn(),
    objectUpdate: vi.fn(),
    objectUpdateMany: vi.fn(),
  };
});

vi.mock("@/lib/adapters/cloudflare-runtime", () => ({
  getCloudflareR2PublicationsBucket: mocks.getBucket,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    ingestionBatch: { findUnique: mocks.batchFindUnique },
    ingestionBatchObject: { findFirst: mocks.batchObjectFindFirst },
    publicationObject: {
      update: mocks.objectUpdate,
      updateMany: mocks.objectUpdateMany,
    },
  },
}));

import {
  PublicationObjectBadRequestError,
  PublicationObjectNotFoundError,
  PublicationObjectStorageUnavailableError,
  planPublicationObjects,
  uploadPublicationObject,
} from "@/features/publications/server/publication-object-service";

const sha256OfAbc =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const principal = PUBLICATION_INGESTION_SERVICE_PRINCIPAL;

function body(value: string) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(value));
      controller.close();
    },
  });
}

function configureObject() {
  const claim = {
    expectedContentType: "text/plain",
    expectedSha256: sha256OfAbc,
    expectedSize: 3,
    object: {
      id: "object-1",
      kind: "body_html",
      r2Key: `publications/body_html/sha256/ba/${sha256OfAbc}`,
      sha256: sha256OfAbc,
      status: "pending",
    },
  };
  mocks.batchFindUnique.mockResolvedValue({ objects: [claim] });
  mocks.batchObjectFindFirst.mockResolvedValue(claim);
  mocks.objectUpdate.mockResolvedValue({});
  mocks.objectUpdateMany.mockResolvedValue({ count: 1 });
  mocks.bucket.put.mockResolvedValue({});
  mocks.bucket.head.mockResolvedValue({
    checksums: { sha256: checksumBytes(sha256OfAbc) },
    customMetadata: { kind: "body_html", sha256: sha256OfAbc },
    httpMetadata: { contentType: "text/plain" },
    size: 3,
  });
}

function checksumBytes(value: string) {
  return Uint8Array.from(value.match(/../g) ?? [], (pair) =>
    Number.parseInt(pair, 16),
  ).buffer;
}

describe("publication object upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureObject();
  });

  it("streams through R2 with the manifest SHA-256 and links after verification", async () => {
    const stream = body("abc");
    await expect(
      uploadPublicationObject({
        body: stream,
        principal,
        payload: {
          batchId: "batch-1",
          kind: "body_html",
          sha256: sha256OfAbc,
        },
        size: 3,
      }),
    ).resolves.toMatchObject({ status: "linked" });

    expect(mocks.bucket.put).toHaveBeenCalledWith(
      `publications/body_html/sha256/ba/${sha256OfAbc}`,
      stream,
      {
        customMetadata: { kind: "body_html", sha256: sha256OfAbc },
        httpMetadata: { contentType: "text/plain" },
        sha256: sha256OfAbc,
      },
    );
    expect(mocks.bucket.get).not.toHaveBeenCalled();
    expect(mocks.objectUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.objectUpdate).toHaveBeenCalledWith({
      where: { id: "object-1" },
      data: {
        status: "linked",
        verifiedAt: expect.any(Date),
        lastError: null,
      },
    });
  });

  it("rejects a request size that differs from the batch manifest", async () => {
    await expect(
      uploadPublicationObject({
        body: body("abc"),
        principal,
        payload: {
          batchId: "batch-1",
          kind: "body_html",
          sha256: sha256OfAbc,
        },
        size: 4,
      }),
    ).rejects.toThrow("object size does not match manifest");
    expect(mocks.bucket.put).not.toHaveBeenCalled();
  });

  it("does not link when the stored R2 checksum differs", async () => {
    mocks.bucket.head.mockResolvedValue({
      checksums: { sha256: checksumBytes("0".repeat(64)) },
      customMetadata: { kind: "body_html", sha256: sha256OfAbc },
      httpMetadata: { contentType: "text/plain" },
      size: 3,
    });

    await expect(
      uploadPublicationObject({
        body: body("abc"),
        principal,
        payload: {
          batchId: "batch-1",
          kind: "body_html",
          sha256: sha256OfAbc,
        },
        size: 3,
      }),
    ).rejects.toThrow("object checksum does not match manifest");
    expect(mocks.bucket.get).not.toHaveBeenCalled();
    expect(mocks.objectUpdate).toHaveBeenCalledWith({
      where: { id: "object-1" },
      data: {
        status: "failed",
        lastError: "object checksum does not match manifest",
      },
    });
  });

  it("uses the canonical claim MIME for planning and upload", async () => {
    const canonicalContentType =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const claim = {
      expectedContentType: canonicalContentType,
      expectedSha256: sha256OfAbc,
      expectedSize: 3,
      object: {
        id: "object-1",
        kind: "body_html" as const,
        r2Key: `publications/body_html/sha256/ba/${sha256OfAbc}`,
        sha256: sha256OfAbc,
        status: "pending" as const,
        contentType: canonicalContentType,
      },
    };
    mocks.batchFindUnique.mockResolvedValue({ objects: [claim] });
    mocks.batchObjectFindFirst.mockResolvedValue(claim);
    mocks.bucket.head.mockResolvedValueOnce(null).mockResolvedValueOnce({
      checksums: { sha256: checksumBytes(sha256OfAbc) },
      customMetadata: { kind: "body_html", sha256: sha256OfAbc },
      httpMetadata: { contentType: canonicalContentType },
      size: 3,
    });

    const planned = await planPublicationObjects({
      origin: "https://life.example",
      principal,
      payload: {
        batchId: "batch-canonical-content-type",
        objects: [{ kind: "body_html", sha256: sha256OfAbc }],
      },
    });
    expect(planned.objects[0]?.requiredHeaders).toMatchObject({
      "Content-Type": canonicalContentType,
    });
    expect(planned.objects[0]?.uploadUrl).toBe(
      `https://life.example/api/ingestion/publications/objects/batch-canonical-content-type/body_html/${sha256OfAbc}`,
    );

    await expect(
      uploadPublicationObject({
        body: body("abc"),
        principal,
        payload: {
          batchId: "batch-canonical-content-type",
          kind: "body_html",
          sha256: sha256OfAbc,
        },
        size: 3,
      }),
    ).resolves.toMatchObject({ status: "linked" });
    expect(mocks.objectUpdate).toHaveBeenCalledWith({
      where: { id: "object-1" },
      data: {
        status: "linked",
        verifiedAt: expect.any(Date),
        lastError: null,
      },
    });
    expect(mocks.bucket.put).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(ReadableStream),
      expect.objectContaining({
        httpMetadata: { contentType: canonicalContentType },
        sha256: sha256OfAbc,
      }),
    );
  });

  it("reuses a linked object's completed verification without reading R2", async () => {
    const claim = {
      expectedContentType: "text/plain",
      expectedSha256: sha256OfAbc,
      expectedSize: 3,
      object: {
        id: "object-1",
        kind: "body_html" as const,
        r2Key: `publications/body_html/sha256/ba/${sha256OfAbc}`,
        sha256: sha256OfAbc,
        status: "linked" as const,
      },
    };
    mocks.batchFindUnique.mockResolvedValue({ objects: [claim] });

    const planned = await planPublicationObjects({
      origin: "https://life.example",
      principal,
      payload: {
        batchId: "batch-linked",
        objects: [{ kind: "body_html", sha256: sha256OfAbc }],
      },
    });

    expect(planned.objects).toEqual([
      expect.objectContaining({
        kind: "body_html",
        sha256: sha256OfAbc,
        status: "already_present",
        uploadUrl: null,
      }),
    ]);
    expect(mocks.getBucket).not.toHaveBeenCalled();
    expect(mocks.bucket.head).not.toHaveBeenCalled();
    expect(mocks.bucket.get).not.toHaveBeenCalled();
    expect(mocks.objectUpdateMany).not.toHaveBeenCalled();
  });

  it("trusts a verified object's prior verification without reading R2", async () => {
    const claim = {
      expectedContentType: "text/plain",
      expectedSha256: sha256OfAbc,
      expectedSize: 3,
      object: {
        id: "object-1",
        kind: "body_html" as const,
        r2Key: `publications/body_html/sha256/ba/${sha256OfAbc}`,
        sha256: sha256OfAbc,
        status: "verified" as const,
      },
    };
    mocks.batchFindUnique.mockResolvedValue({ objects: [claim] });

    const planned = await planPublicationObjects({
      origin: "https://life.example",
      principal,
      payload: {
        batchId: "batch-verified",
        objects: [{ kind: "body_html", sha256: sha256OfAbc }],
      },
    });

    expect(planned.objects).toEqual([
      expect.objectContaining({
        kind: "body_html",
        sha256: sha256OfAbc,
        status: "already_present",
        uploadUrl: null,
      }),
    ]);
    expect(mocks.getBucket).not.toHaveBeenCalled();
    expect(mocks.bucket.head).not.toHaveBeenCalled();
    expect(mocks.bucket.get).not.toHaveBeenCalled();
    expect(mocks.objectUpdateMany).not.toHaveBeenCalled();
  });

  it("heads R2 and requires upload for a pending object missing from storage", async () => {
    mocks.bucket.head.mockResolvedValue(null);

    const planned = await planPublicationObjects({
      origin: "https://life.example",
      principal,
      payload: {
        batchId: "batch-pending",
        objects: [{ kind: "body_html", sha256: sha256OfAbc }],
      },
    });

    expect(planned.objects).toEqual([
      expect.objectContaining({
        kind: "body_html",
        sha256: sha256OfAbc,
        status: "upload_required",
        uploadUrl: `https://life.example/api/ingestion/publications/objects/batch-pending/body_html/${sha256OfAbc}`,
      }),
    ]);
    expect(mocks.bucket.head).toHaveBeenCalledTimes(1);
    expect(mocks.bucket.get).not.toHaveBeenCalled();
    expect(mocks.objectUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["object-1"] } },
      data: { status: "pending", lastError: null },
    });
  });

  it("plans a large request with one batch lookup and bounded R2 concurrency", async () => {
    const objectCount = 500;
    const claims = Array.from({ length: objectCount }, (_, index) => {
      const sha256 = index.toString(16).padStart(64, "0");
      return {
        expectedContentType: "text/plain",
        expectedSha256: sha256,
        expectedSize: 3,
        object: {
          id: `object-${index}`,
          kind: "body_html" as const,
          r2Key: `publications/body_html/sha256/${sha256.slice(0, 2)}/${sha256}`,
          sha256,
          status: "pending" as const,
        },
      };
    });
    mocks.batchFindUnique.mockResolvedValue({ objects: claims });

    let activeHeads = 0;
    let maxActiveHeads = 0;
    mocks.bucket.head.mockImplementation(async (r2Key: string) => {
      activeHeads += 1;
      maxActiveHeads = Math.max(maxActiveHeads, activeHeads);
      await new Promise((resolve) => setTimeout(resolve, 1));
      activeHeads -= 1;
      const sha256 = r2Key.split("/").at(-1) ?? "";
      return {
        checksums: { sha256: checksumBytes(sha256) },
        customMetadata: { kind: "body_html", sha256 },
        httpMetadata: { contentType: "text/plain" },
        size: 3,
      };
    });

    const payload: PublicationObjectPlanRequest = {
      batchId: "batch-large",
      objects: claims.map(({ object }) => ({
        kind: object.kind,
        sha256: object.sha256,
      })),
    };
    const result = await planPublicationObjects({
      origin: "https://life.example",
      principal,
      payload,
    });

    expect(result.objects).toHaveLength(objectCount);
    expect(
      result.objects.every(({ status }) => status === "already_present"),
    ).toBe(true);
    expect(mocks.batchFindUnique).toHaveBeenCalledTimes(1);
    expect(mocks.batchObjectFindFirst).not.toHaveBeenCalled();
    expect(mocks.objectUpdate).not.toHaveBeenCalled();
    expect(mocks.objectUpdateMany).toHaveBeenCalledTimes(1);
    expect(mocks.objectUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: claims.map(({ object }) => object.id) } },
      data: {
        status: "linked",
        verifiedAt: expect.any(Date),
        lastError: null,
      },
    });
    expect(maxActiveHeads).toBeGreaterThan(1);
    expect(maxActiveHeads).toBeLessThanOrEqual(8);
  });

  it("rejects duplicate object manifests before looking up batch ownership", async () => {
    await expect(
      planPublicationObjects({
        origin: "https://life.example",
        principal,
        payload: {
          batchId: "batch-duplicate",
          objects: [
            { kind: "body_html", sha256: sha256OfAbc },
            { kind: "body_html", sha256: sha256OfAbc },
          ],
        },
      }),
    ).rejects.toBeInstanceOf(PublicationObjectBadRequestError);
    expect(mocks.batchFindUnique).not.toHaveBeenCalled();
  });

  it("distinguishes a missing batch from an object absent from a batch", async () => {
    mocks.batchFindUnique.mockResolvedValueOnce(null);
    await expect(
      planPublicationObjects({
        origin: "https://life.example",
        principal,
        payload: {
          batchId: "batch-missing",
          objects: [{ kind: "body_html", sha256: sha256OfAbc }],
        },
      }),
    ).rejects.toBeInstanceOf(PublicationObjectNotFoundError);

    mocks.batchFindUnique.mockResolvedValueOnce({ objects: [] });
    await expect(
      planPublicationObjects({
        origin: "https://life.example",
        principal,
        payload: {
          batchId: "batch-without-object",
          objects: [{ kind: "body_html", sha256: sha256OfAbc }],
        },
      }),
    ).rejects.toMatchObject({
      code: "publication_object_not_found",
      message: "Object is not in this batch",
    });
  });

  it("rejects a stored key that is no longer content addressed", async () => {
    const claim = {
      expectedContentType: "text/plain",
      expectedSha256: sha256OfAbc,
      expectedSize: 3,
      object: {
        id: "object-1",
        kind: "body_html" as const,
        r2Key: "publications/body_html/not-the-digest",
        sha256: sha256OfAbc,
        status: "pending" as const,
      },
    };
    mocks.batchFindUnique.mockResolvedValueOnce({ objects: [claim] });

    await expect(
      planPublicationObjects({
        origin: "https://life.example",
        principal,
        payload: {
          batchId: "batch-bad-key",
          objects: [{ kind: "body_html", sha256: sha256OfAbc }],
        },
      }),
    ).rejects.toMatchObject({
      code: "publication_object_bad_request",
      message: "Stored object key does not match its content address",
    });
    expect(mocks.getBucket).not.toHaveBeenCalled();
  });

  it("reports storage binding and upload failures without claiming the object", async () => {
    mocks.getBucket.mockReturnValueOnce(undefined);
    await expect(
      planPublicationObjects({
        origin: "https://life.example",
        principal,
        payload: {
          batchId: "batch-no-storage",
          objects: [{ kind: "body_html", sha256: sha256OfAbc }],
        },
      }),
    ).rejects.toBeInstanceOf(PublicationObjectStorageUnavailableError);

    mocks.bucket.put.mockRejectedValueOnce(new Error("R2 unavailable"));
    await expect(
      uploadPublicationObject({
        body: body("abc"),
        principal,
        payload: {
          batchId: "batch-put-failed",
          kind: "body_html",
          sha256: sha256OfAbc,
        },
        size: 3,
      }),
    ).rejects.toMatchObject({
      code: "publication_object_storage_unavailable",
      message: "R2 publication object upload failed",
    });
    expect(mocks.objectUpdate).not.toHaveBeenCalled();
  });

  it("verifies metadata and hashes object bytes when R2 omits a checksum", async () => {
    mocks.bucket.head.mockResolvedValue({
      customMetadata: { kind: "body_html", sha256: sha256OfAbc },
      httpMetadata: { contentType: "text/plain" },
      size: 3,
    });
    mocks.bucket.get.mockResolvedValue({ body: body("abc") });

    await expect(
      uploadPublicationObject({
        body: body("abc"),
        principal,
        payload: {
          batchId: "batch-byte-verified",
          kind: "body_html",
          sha256: sha256OfAbc,
        },
        size: 3,
      }),
    ).resolves.toMatchObject({ status: "linked" });
    expect(mocks.bucket.get).toHaveBeenCalledWith(
      `publications/body_html/sha256/ba/${sha256OfAbc}`,
    );

    mocks.bucket.head.mockResolvedValueOnce({
      customMetadata: { kind: "body_html", sha256: sha256OfAbc },
      httpMetadata: { contentType: "text/plain" },
      size: 3,
    });
    mocks.bucket.get.mockResolvedValueOnce({ body: body("bad") });
    await expect(
      uploadPublicationObject({
        body: body("abc"),
        principal,
        payload: {
          batchId: "batch-byte-mismatch",
          kind: "body_html",
          sha256: sha256OfAbc,
        },
        size: 3,
      }),
    ).rejects.toMatchObject({
      code: "publication_object_bad_request",
      message: "object content does not match manifest",
    });
    expect(mocks.objectUpdate).toHaveBeenLastCalledWith({
      where: { id: "object-1" },
      data: {
        status: "failed",
        lastError: "object content does not match manifest",
      },
    });
  });

  it("rejects metadata mismatches and missing objects during verification", async () => {
    mocks.bucket.head.mockResolvedValueOnce({
      customMetadata: { kind: "body_html", sha256: sha256OfAbc },
      httpMetadata: { contentType: "application/json" },
      size: 3,
    });
    await expect(
      uploadPublicationObject({
        body: body("abc"),
        principal,
        payload: {
          batchId: "batch-mime-mismatch",
          kind: "body_html",
          sha256: sha256OfAbc,
        },
        size: 3,
      }),
    ).rejects.toThrow("object content type does not match manifest");

    mocks.bucket.head.mockResolvedValueOnce({
      customMetadata: { kind: "body_html", sha256: sha256OfAbc },
      httpMetadata: { contentType: "text/plain" },
      size: 3,
    });
    mocks.bucket.get.mockResolvedValueOnce(null);
    await expect(
      uploadPublicationObject({
        body: body("abc"),
        principal,
        payload: {
          batchId: "batch-body-missing",
          kind: "body_html",
          sha256: sha256OfAbc,
        },
        size: 3,
      }),
    ).rejects.toThrow("object is missing");
    expect(mocks.objectUpdate).toHaveBeenLastCalledWith({
      where: { id: "object-1" },
      data: { status: "failed", lastError: "object is missing" },
    });
  });

  it("marks an object for upload when its stored size is stale", async () => {
    mocks.bucket.head.mockResolvedValueOnce({
      customMetadata: { kind: "body_html", sha256: sha256OfAbc },
      httpMetadata: { contentType: "text/plain" },
      size: 4,
    });

    await expect(
      planPublicationObjects({
        origin: "https://life.example",
        principal,
        payload: {
          batchId: "batch-size-mismatch",
          objects: [{ kind: "body_html", sha256: sha256OfAbc }],
        },
      }),
    ).resolves.toMatchObject({
      objects: [
        expect.objectContaining({
          status: "upload_required",
          uploadUrl: expect.stringContaining("batch-size-mismatch"),
        }),
      ],
    });
  });

  it("rejects an upload claim that is missing or points at a non-canonical key", async () => {
    mocks.batchObjectFindFirst.mockResolvedValueOnce(null);
    mocks.batchFindUnique.mockResolvedValueOnce({ id: "batch-1" });
    await expect(
      uploadPublicationObject({
        body: body("abc"),
        principal,
        payload: {
          batchId: "batch-claim-missing",
          kind: "body_html",
          sha256: sha256OfAbc,
        },
        size: 3,
      }),
    ).rejects.toMatchObject({
      code: "publication_object_not_found",
      message: "Object is not in this batch",
    });

    mocks.batchObjectFindFirst.mockResolvedValueOnce(null);
    mocks.batchFindUnique.mockResolvedValueOnce(null);
    await expect(
      uploadPublicationObject({
        body: body("abc"),
        principal,
        payload: {
          batchId: "batch-claim-batch-missing",
          kind: "body_html",
          sha256: sha256OfAbc,
        },
        size: 3,
      }),
    ).rejects.toMatchObject({
      code: "publication_object_not_found",
      message: "Ingestion batch not found",
    });

    const badClaim = {
      expectedContentType: "text/plain",
      expectedSha256: sha256OfAbc,
      expectedSize: 3,
      object: {
        id: "object-1",
        kind: "body_html" as const,
        r2Key: "publications/body_html/not-content-addressed",
        sha256: sha256OfAbc,
        status: "pending" as const,
      },
    };
    mocks.batchObjectFindFirst.mockResolvedValueOnce(badClaim);
    await expect(
      uploadPublicationObject({
        body: body("abc"),
        principal,
        payload: {
          batchId: "batch-claim-bad-key",
          kind: "body_html",
          sha256: sha256OfAbc,
        },
        size: 3,
      }),
    ).rejects.toMatchObject({
      code: "publication_object_bad_request",
      message: "Stored object key does not match its content address",
    });
  });

  it("records a failed verification when object metadata does not match", async () => {
    mocks.bucket.head.mockResolvedValueOnce({
      customMetadata: { kind: "body_html", sha256: "0".repeat(64) },
      httpMetadata: { contentType: "text/plain" },
      size: 3,
    });

    await expect(
      uploadPublicationObject({
        body: body("abc"),
        principal,
        payload: {
          batchId: "batch-metadata-mismatch",
          kind: "body_html",
          sha256: sha256OfAbc,
        },
        size: 3,
      }),
    ).rejects.toThrow("object metadata does not match manifest");
    expect(mocks.objectUpdate).toHaveBeenLastCalledWith({
      where: { id: "object-1" },
      data: {
        status: "failed",
        lastError: "object metadata does not match manifest",
      },
    });
  });
});
