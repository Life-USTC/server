import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicationObjectPlanRequest } from "@/lib/api/schemas/request-publication-ingestion-schemas";
import { PUBLICATION_INGESTION_SERVICE_PRINCIPAL } from "@/lib/auth/service-principal";

const mocks = vi.hoisted(() => {
  const bucket = {
    head: vi.fn(),
    get: vi.fn(),
  };
  return {
    bucket,
    getBucket: vi.fn(() => bucket),
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
  completePublicationObject,
  planPublicationObjects,
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
  mocks.bucket.head.mockResolvedValue({
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

describe("publication object completion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureObject();
  });

  it("hashes bytes when R2 does not expose a SHA-256 checksum", async () => {
    mocks.bucket.get.mockResolvedValue({ body: body("bad") });

    await expect(
      completePublicationObject({
        principal,
        payload: {
          batchId: "batch-1",
          kind: "body_html",
          sha256: sha256OfAbc,
        },
      }),
    ).rejects.toThrow("object content does not match manifest");

    expect(mocks.bucket.get).toHaveBeenCalledWith(
      `publications/body_html/sha256/ba/${sha256OfAbc}`,
    );
    expect(mocks.batchObjectFindFirst).toHaveBeenCalledTimes(1);
    expect(mocks.batchFindUnique).not.toHaveBeenCalled();
    expect(mocks.objectUpdate).toHaveBeenLastCalledWith({
      where: { id: "object-1" },
      data: {
        status: "failed",
        lastError: "object content does not match manifest",
      },
    });
  });

  it("links only after the actual bytes verify", async () => {
    mocks.bucket.get.mockResolvedValue({ body: body("abc") });

    await expect(
      completePublicationObject({
        principal,
        payload: {
          batchId: "batch-1",
          kind: "body_html",
          sha256: sha256OfAbc,
        },
      }),
    ).resolves.toMatchObject({ status: "linked" });

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
    const result = await planPublicationObjects({ principal, payload });

    expect(result.objects).toHaveLength(objectCount);
    expect(
      result.objects.every(({ status }) => status === "already_present"),
    ).toBe(true);
    expect(mocks.batchFindUnique).toHaveBeenCalledTimes(1);
    expect(mocks.batchObjectFindFirst).not.toHaveBeenCalled();
    expect(mocks.objectUpdate).not.toHaveBeenCalled();
    expect(mocks.objectUpdateMany).toHaveBeenCalledTimes(1);
    expect(maxActiveHeads).toBeGreaterThan(1);
    expect(maxActiveHeads).toBeLessThanOrEqual(8);
  });
});
