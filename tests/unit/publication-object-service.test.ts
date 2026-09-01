import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const bucket = {
    head: vi.fn(),
    get: vi.fn(),
  };
  return {
    bucket,
    getBucket: vi.fn(() => bucket),
    userFindUnique: vi.fn(),
    batchFindUnique: vi.fn(),
    objectUpdate: vi.fn(),
  };
});

vi.mock("@/lib/adapters/cloudflare-runtime", () => ({
  getCloudflareR2PublicationsBucket: mocks.getBucket,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    ingestionBatch: { findUnique: mocks.batchFindUnique },
    publicationObject: { update: mocks.objectUpdate },
  },
}));

import { completePublicationObject } from "@/features/publications/server/publication-object-service";

const sha256OfAbc =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const principal = {
  kind: "oauth" as const,
  userId: "admin-user",
  clientId: "crawler-client",
  scopes: new Set(["publication.ingest:write"]),
};

function body(value: string) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(value));
      controller.close();
    },
  });
}

function configureObject() {
  mocks.userFindUnique.mockResolvedValue({ isAdmin: true });
  mocks.batchFindUnique.mockResolvedValue({
    objects: [
      {
        expectedContentType: "text/plain",
        expectedSha256: sha256OfAbc,
        expectedSize: 3,
        object: {
          id: "object-1",
          kind: "body_html",
          r2Key: `publications/body_html/sha256/ba/${sha256OfAbc}`,
          sha256: sha256OfAbc,
        },
      },
    ],
  });
  mocks.objectUpdate.mockResolvedValue({});
  mocks.bucket.head.mockResolvedValue({
    customMetadata: { kind: "body_html", sha256: sha256OfAbc },
    httpMetadata: { contentType: "text/plain" },
    size: 3,
  });
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

    expect(mocks.objectUpdate).toHaveBeenCalledTimes(3);
    expect(
      mocks.objectUpdate.mock.calls.map(([call]) => call.data.status),
    ).toEqual(["uploaded", "verified", "linked"]);
  });
});
