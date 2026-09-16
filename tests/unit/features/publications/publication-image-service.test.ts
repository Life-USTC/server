import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  imageSourceFindUnique: vi.fn(),
  bucket: {
    head: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
  },
  bucketAvailable: true,
  fetchMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    publicationImageSource: { findUnique: mocks.imageSourceFindUnique },
  },
}));

vi.mock("@/lib/adapters/cloudflare-runtime", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/lib/adapters/cloudflare-runtime")
  >()),
  getCloudflareR2PublicationsBucket: () =>
    mocks.bucketAvailable ? mocks.bucket : undefined,
}));

import {
  getPublicationImageResponse,
  PUBLICATION_IMAGE_CACHE_HEADERS,
  PUBLICATION_IMAGE_MAX_BYTES,
  publicationImageR2Key,
} from "@/features/publications/server/publication-image-service";
import { getPublicPublicationImageRoute } from "@/lib/api/routes/publication-public-routes";

async function hashUrl(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function stream(value: string) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(value));
      controller.close();
    },
  });
}

function sourceRecord(
  url: string,
  hash: string,
  source: { allowedHosts?: string[]; blockedHosts?: string[] } = {},
) {
  return {
    id: hash,
    url,
    revisions: [
      {
        revision: {
          currentFor: { id: "publication-1" },
          publication: {
            id: "publication-1",
            source: {
              allowedHosts: source.allowedHosts ?? ["news.example.test"],
              blockedHosts: source.blockedHosts ?? [],
            },
          },
        },
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.bucketAvailable = true;
  mocks.bucket.head.mockResolvedValue(null);
  mocks.bucket.put.mockResolvedValue(undefined);
  mocks.fetchMock.mockReset();
  vi.stubGlobal("fetch", mocks.fetchMock);
});

describe("publication image service", () => {
  it("resolves a public URL hash, fetches raster bytes, and caches successful responses", async () => {
    const url = "https://news.example.test/images/campus.png";
    const hash = await hashUrl(url);
    mocks.imageSourceFindUnique.mockResolvedValue(sourceRecord(url, hash));
    mocks.fetchMock.mockResolvedValue(
      new Response(stream("image-bytes"), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      }),
    );

    const deferred: Promise<unknown>[] = [];
    const response = await getPublicPublicationImageRoute(
      new Request(`https://life.test/api/publications/images/${hash}`),
      { hash },
      { defer: (promise) => deferred.push(promise) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toBe(
      PUBLICATION_IMAGE_CACHE_HEADERS["Cache-Control"],
    );
    expect(response.headers.get("Cache-Control")).not.toContain("immutable");
    await expect(response.text()).resolves.toBe("image-bytes");
    expect(mocks.fetchMock).toHaveBeenCalledWith(
      new URL(url),
      expect.objectContaining({
        redirect: "manual",
        signal: expect.anything(),
      }),
    );
    expect(mocks.bucket.put).toHaveBeenCalledWith(
      publicationImageR2Key(hash),
      expect.any(Uint8Array),
      { httpMetadata: { contentType: "image/png" } },
    );
    await expect(Promise.all(deferred)).resolves.toHaveLength(1);
  });

  it("serves a verified R2 cache hit and handles conditional requests", async () => {
    const url = "https://news.example.test/images/campus.png";
    const hash = await hashUrl(url);
    mocks.imageSourceFindUnique.mockResolvedValue(sourceRecord(url, hash));
    mocks.bucket.head.mockResolvedValue({
      size: 11,
      etag: "cached-etag",
      httpMetadata: { contentType: "image/png" },
    });
    mocks.bucket.get.mockResolvedValue({
      size: 11,
      body: stream("cached-bytes"),
    });

    const response = await getPublicationImageResponse({
      request: new Request(`https://life.test/api/publications/images/${hash}`),
      hash,
    });
    expect(response?.status).toBe(200);
    await expect(response?.text()).resolves.toBe("cached-bytes");
    expect(mocks.fetchMock).not.toHaveBeenCalled();

    const notModified = await getPublicationImageResponse({
      request: new Request(
        `https://life.test/api/publications/images/${hash}`,
        { headers: { "If-None-Match": 'W/"cached-etag"' } },
      ),
      hash,
    });
    expect(notModified?.status).toBe(304);
    expect(mocks.bucket.get).toHaveBeenCalledTimes(1);
  });

  it("allows an external image host registered by the trusted crawler", async () => {
    const url = "https://img-xhpfm.xinhuaxmt.com/images/campus.jpg";
    const hash = await hashUrl(url);
    mocks.imageSourceFindUnique.mockResolvedValue(
      sourceRecord(url, hash, { allowedHosts: ["news.ustc.edu.cn"] }),
    );
    mocks.fetchMock.mockResolvedValue(
      new Response(stream("external-image"), {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      }),
    );

    const response = await getPublicationImageResponse({
      request: new Request(`https://life.test/api/publications/images/${hash}`),
      hash,
    });

    expect(response?.status).toBe(200);
    expect(response?.headers.get("Content-Type")).toBe("image/jpeg");
    await expect(response?.text()).resolves.toBe("external-image");
    expect(mocks.fetchMock).toHaveBeenCalledWith(
      new URL(url),
      expect.objectContaining({ redirect: "manual" }),
    );
  });

  it("allows same-host redirects but rejects an unregistered subdomain", async () => {
    const url = "https://img-xhpfm.xinhuaxmt.com/images/campus.png";
    const hash = await hashUrl(url);
    mocks.imageSourceFindUnique.mockResolvedValue(
      sourceRecord(url, hash, { allowedHosts: ["news.ustc.edu.cn"] }),
    );
    mocks.fetchMock
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { Location: "/images/current.png" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(stream("redirected-image"), {
          status: 200,
          headers: { "Content-Type": "image/png" },
        }),
      );

    const response = await getPublicationImageResponse({
      request: new Request(`https://life.test/api/publications/images/${hash}`),
      hash,
    });
    expect(response?.status).toBe(200);
    await expect(response?.text()).resolves.toBe("redirected-image");
    expect(mocks.fetchMock).toHaveBeenCalledTimes(2);

    mocks.fetchMock.mockReset();
    mocks.fetchMock.mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: {
          Location: "https://cdn.img-xhpfm.xinhuaxmt.com/images/current.png",
        },
      }),
    );
    const rejected = await getPublicationImageResponse({
      request: new Request(`https://life.test/api/publications/images/${hash}`),
      hash,
    }).catch(() => null);
    expect(rejected).toBeNull();
    expect(mocks.fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.bucket.put).toHaveBeenCalledTimes(1);
  });

  it.each([
    "https://127.0.0.1/image.png",
    "https://localhost/image.png",
    "https://news.example.test:8443/image.png",
    "https://user:password@news.example.test/image.png",
    "file:///tmp/image.png",
  ])("rejects unsafe origin %s before fetching", async (url) => {
    const hash = await hashUrl(url);
    mocks.imageSourceFindUnique.mockResolvedValue(sourceRecord(url, hash));

    await expect(
      getPublicationImageResponse({
        request: new Request(
          `https://life.test/api/publications/images/${hash}`,
        ),
        hash,
      }),
    ).resolves.toBeNull();
    expect(mocks.bucket.head).not.toHaveBeenCalled();
    expect(mocks.fetchMock).not.toHaveBeenCalled();
  });

  it("keeps source blocked hosts authoritative over registered image hosts", async () => {
    const url = "https://img-xhpfm.xinhuaxmt.com/images/campus.png";
    const hash = await hashUrl(url);
    mocks.imageSourceFindUnique.mockResolvedValue(
      sourceRecord(url, hash, {
        allowedHosts: ["news.ustc.edu.cn"],
        blockedHosts: ["xinhuaxmt.com"],
      }),
    );

    await expect(
      getPublicationImageResponse({
        request: new Request(
          `https://life.test/api/publications/images/${hash}`,
        ),
        hash,
      }),
    ).resolves.toBeNull();
    expect(mocks.bucket.head).not.toHaveBeenCalled();
    expect(mocks.fetchMock).not.toHaveBeenCalled();
  });

  it("validates redirect targets and does not cache failed origin responses", async () => {
    const url = "https://news.example.test/images/campus.png";
    const hash = await hashUrl(url);
    mocks.imageSourceFindUnique.mockResolvedValue(sourceRecord(url, hash));
    mocks.fetchMock.mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { Location: "https://evil.example/image.png" },
      }),
    );

    const response = await getPublicPublicationImageRoute(
      new Request(`https://life.test/api/publications/images/${hash}`),
      { hash },
    );
    expect(response).toBeInstanceOf(Response);
    expect(response?.status).toBe(502);
    expect(mocks.fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.bucket.put).not.toHaveBeenCalled();
  });

  it("rejects a declared non-raster MIME even when the URL has an image extension", async () => {
    const url = "https://news.example.test/images/campus.png";
    const hash = await hashUrl(url);
    mocks.imageSourceFindUnique.mockResolvedValue(sourceRecord(url, hash));
    mocks.fetchMock.mockResolvedValue(
      new Response(stream("not-an-image"), {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }),
    );

    const response = await getPublicPublicationImageRoute(
      new Request(`https://life.test/api/publications/images/${hash}`),
      { hash },
    );
    expect(response.status).toBe(502);
    expect(mocks.bucket.put).not.toHaveBeenCalled();
  });

  it("rejects an empty origin body without caching it", async () => {
    const url = "https://news.example.test/images/campus.png";
    const hash = await hashUrl(url);
    mocks.imageSourceFindUnique.mockResolvedValue(sourceRecord(url, hash));
    mocks.fetchMock.mockResolvedValue(
      new Response(
        new ReadableStream<Uint8Array>({
          start: (controller) => controller.close(),
        }),
        {
          status: 200,
          headers: { "Content-Type": "image/png" },
        },
      ),
    );

    const response = await getPublicPublicationImageRoute(
      new Request(`https://life.test/api/publications/images/${hash}`),
      { hash },
    );
    expect(response.status).toBe(502);
    expect(mocks.bucket.put).not.toHaveBeenCalled();
  });

  it("enforces the streaming body limit before persisting bytes", async () => {
    const url = "https://news.example.test/images/campus.png";
    const hash = await hashUrl(url);
    mocks.imageSourceFindUnique.mockResolvedValue(sourceRecord(url, hash));
    mocks.fetchMock.mockResolvedValue(
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array(PUBLICATION_IMAGE_MAX_BYTES));
            controller.enqueue(new Uint8Array(1));
            controller.close();
          },
        }),
        { headers: { "Content-Type": "image/png" } },
      ),
    );

    const response = await getPublicationImageResponse({
      request: new Request(`https://life.test/api/publications/images/${hash}`),
      hash,
    }).catch(() => null);
    expect(response).toBeNull();
    expect(mocks.bucket.put).not.toHaveBeenCalled();
  });
});
