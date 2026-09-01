import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  publicationFindMany: vi.fn(),
  publicationCount: vi.fn(),
  publicationFindFirst: vi.fn(),
  publicationObjectFindUnique: vi.fn(),
  bucket: {
    head: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
    publication: {
      findMany: mocks.publicationFindMany,
      count: mocks.publicationCount,
      findFirst: mocks.publicationFindFirst,
    },
    publicationObject: {
      findUnique: mocks.publicationObjectFindUnique,
    },
  },
}));

vi.mock("@/lib/adapters/cloudflare-runtime", () => ({
  getCloudflareR2PublicationsBucket: () => mocks.bucket,
}));

import {
  getPublicPublicationById,
  getPublicPublicationObjectResponse,
  listPublications,
} from "@/features/publications/server/publication-public-read-service";

const digest = "a".repeat(64);
const secondDigest = "b".repeat(64);

function revision(overrides: Record<string, unknown> = {}) {
  return {
    id: "revision-1",
    revisionHash: digest,
    observedAt: new Date("2026-09-01T02:00:00.000Z"),
    isTombstone: false,
    title: "Campus update",
    author: "USTC",
    publishedAt: new Date("2026-08-31T16:00:00.000Z"),
    updatedAtSource: null,
    category: "Campus",
    summary: "Summary",
    bodyText: "Plain body",
    sourcePageUrl: "https://news.ustc.edu.cn/item",
    extractionMethod: "fixture",
    classifierVersion: "fixture/1",
    publicationType: "news",
    objectLinks: [
      {
        role: "media",
        sortOrder: 0,
        altText: "Campus image",
        object: {
          kind: "media",
          sha256: secondDigest,
          size: 4,
          contentType: "image/png",
          r2Key: `publications/media/sha256/bb/${secondDigest}`,
          status: "linked",
        },
      },
      {
        role: "asset",
        sortOrder: 1,
        altText: null,
        object: {
          kind: "asset",
          sha256: digest,
          size: 4,
          contentType: "application/pdf",
          r2Key: `publications/asset/sha256/aa/${digest}`,
          status: "pending",
        },
      },
    ],
    ...overrides,
  };
}

function publication(overrides: Record<string, unknown> = {}) {
  return {
    id: "publication-1",
    canonicalUrl: "https://news.ustc.edu.cn/item",
    publicationType: "news",
    deletedAt: null,
    title: "Campus update",
    source: {
      id: "ustc-news",
      name: "USTC News",
      organizationLevel: "university",
    },
    currentRevision: revision(),
    ...overrides,
  };
}

function stream(value: string) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(value));
      controller.close();
    },
  });
}

describe("public publication reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated public news and filters unverified objects", async () => {
    mocks.publicationFindMany.mockResolvedValue([publication()]);
    mocks.publicationCount.mockResolvedValue(1);

    const result = await listPublications({
      filters: { type: "news", source: "ustc-news", query: "Campus" },
      pagination: { page: 2, pageSize: 10 },
    });

    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 10,
      total: 1,
      totalPages: 1,
    });
    expect(result.data[0]).toMatchObject({
      id: "publication-1",
      publicationType: "news",
      source: { id: "ustc-news" },
      revision: { title: "Campus update" },
      objects: [
        {
          kind: "media",
          status: "linked",
          url: `/api/publications/objects/media/${secondDigest}`,
        },
      ],
    });

    const query = mocks.publicationFindMany.mock.calls[0][0];
    expect(query.skip).toBe(10);
    expect(query.take).toBe(10);
    expect(query.where).toMatchObject({
      deletedAt: null,
      sourceId: "ustc-news",
      publicationType: "news",
      currentRevision: {
        is: { isTombstone: false, publicationType: "news" },
      },
    });
    expect(query.where.OR).toHaveLength(3);
  });

  it("does not expose deleted or other publications through detail", async () => {
    mocks.publicationFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        publication({
          publicationType: "other",
          currentRevision: revision({ publicationType: "other" }),
        }),
      );

    await expect(getPublicPublicationById("deleted")).resolves.toBeNull();
    await expect(getPublicPublicationById("other")).resolves.toBeNull();
    expect(mocks.publicationFindFirst).toHaveBeenCalledTimes(2);
  });

  it("returns detail bodyText and only the effective revision objects", async () => {
    mocks.publicationFindFirst.mockResolvedValue(publication());

    await expect(
      getPublicPublicationById("publication-1"),
    ).resolves.toMatchObject({
      id: "publication-1",
      revision: {
        id: "revision-1",
        bodyText: "Plain body",
        objects: [{ kind: "media" }],
      },
    });
  });

  it("requires a linked object on a current public revision before reading R2", async () => {
    mocks.publicationObjectFindUnique.mockResolvedValue({
      kind: "media",
      sha256: secondDigest,
      r2Key: `publications/media/sha256/bb/${secondDigest}`,
      status: "linked",
      size: 4,
      contentType: "image/png",
      links: [
        {
          role: "media",
          revision: {
            isTombstone: false,
            publicationType: "notice",
            currentFor: { id: "publication-1" },
            publication: {
              id: "publication-1",
              deletedAt: null,
              publicationType: "news",
            },
          },
        },
      ],
    });
    mocks.bucket.head.mockResolvedValue({ size: 4, etag: "r2-etag" });
    mocks.bucket.get.mockResolvedValue({ size: 4, body: stream("bytes") });

    const response = await getPublicPublicationObjectResponse({
      request: new Request(
        `https://life.test/api/publications/objects/media/${secondDigest}`,
      ),
      kind: "media",
      sha256: secondDigest,
    });

    expect(response).toBeInstanceOf(Response);
    expect(response?.status).toBe(200);
    expect(response?.headers.get("ETag")).toBe('"r2-etag"');
    expect(response?.headers.get("Cache-Control")).toContain("immutable");
    expect(response?.headers.get("Content-Disposition")).toBe("inline");
    await expect(response?.text()).resolves.toBe("bytes");
  });

  it("answers 304 and handles an R2 head/get race without exposing bytes", async () => {
    mocks.publicationObjectFindUnique.mockResolvedValue({
      kind: "asset",
      sha256: digest,
      r2Key: `publications/asset/sha256/aa/${digest}`,
      status: "verified",
      size: 4,
      contentType: "application/pdf",
      links: [
        {
          role: "asset",
          revision: {
            isTombstone: false,
            publicationType: "news",
            currentFor: { id: "publication-1" },
            publication: {
              id: "publication-1",
              deletedAt: null,
              publicationType: "news",
            },
          },
        },
      ],
    });
    mocks.bucket.head.mockResolvedValue({ size: 4, etag: '"asset-etag"' });

    const notModified = await getPublicPublicationObjectResponse({
      request: new Request(
        `https://life.test/api/publications/objects/asset/${digest}`,
        { headers: { "If-None-Match": 'W/"asset-etag"' } },
      ),
      kind: "asset",
      sha256: digest,
    });
    expect(notModified?.status).toBe(304);
    expect(mocks.bucket.get).not.toHaveBeenCalled();

    mocks.bucket.get.mockResolvedValue(null);
    const raced = await getPublicPublicationObjectResponse({
      request: new Request(
        `https://life.test/api/publications/objects/asset/${digest}`,
      ),
      kind: "asset",
      sha256: digest,
    });
    expect(raced).toBeNull();
  });

  it("rejects links whose current revision is not a public type", async () => {
    mocks.publicationObjectFindUnique.mockResolvedValue({
      kind: "media",
      sha256: secondDigest,
      r2Key: `publications/media/sha256/bb/${secondDigest}`,
      status: "linked",
      size: 4,
      contentType: "image/png",
      links: [
        {
          role: "media",
          revision: {
            isTombstone: false,
            publicationType: "other",
            currentFor: { id: "publication-1" },
            publication: {
              id: "publication-1",
              deletedAt: null,
              publicationType: "news",
            },
          },
        },
      ],
    });

    await expect(
      getPublicPublicationObjectResponse({
        request: new Request("https://life.test/object"),
        kind: "media",
        sha256: secondDigest,
      }),
    ).resolves.toBeNull();
    expect(mocks.bucket.head).not.toHaveBeenCalled();
  });
});
