import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  youngEventFindUnique: vi.fn(),
  bucket: {
    head: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
  },
  cache: {
    match: vi.fn<(request: Request) => Promise<Response | undefined>>(),
    put: vi.fn<(request: Request, response: Response) => Promise<void>>(),
  },
  state: {
    bucketAvailable: true,
    cacheAvailable: true,
  },
  fetchMock: vi.fn(),
  logAppEvent: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { youngEvent: { findUnique: mocks.youngEventFindUnique } },
}));

vi.mock("@/lib/adapters/cloudflare-runtime", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/lib/adapters/cloudflare-runtime")
  >()),
  getCloudflareNamedCache: () =>
    mocks.state.cacheAvailable ? Promise.resolve(mocks.cache) : undefined,
  getCloudflareR2PublicationsBucket: () =>
    mocks.state.bucketAvailable ? mocks.bucket : undefined,
}));

vi.mock("@/lib/log/app-logger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/log/app-logger")>()),
  logAppEvent: mocks.logAppEvent,
}));

import { YOUNG_EVENT_IMAGE_MAX_BYTES } from "@/features/young/server/young-event-image-service";
import { getYoungEventImageRoute } from "@/lib/api/routes/young-event-routes";

const PIC_PATH = "group1/M00/31/B5/wKgUEWpR3ciAJX_MAABnEoFLBaI860.jpg";
const R2_KEY = `young-events/images/${PIC_PATH}`;
const ORIGIN_URL = `https://young.ustc.edu.cn/login/${PIC_PATH}`;
const ROUTE_URL = "https://life.test/api/catalog/young-events/42/image";
const CACHE_KEY_URL =
  "https://life.test/_life-ustc-internal-cache/young-event-image/v1/42";

function stream(value: string) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(value));
      controller.close();
    },
  });
}

function eventWithImage(imageUrl: string | null = PIC_PATH) {
  return { imageUrl };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mocks.fetchMock);
  mocks.youngEventFindUnique.mockResolvedValue(eventWithImage());
  mocks.state.bucketAvailable = true;
  mocks.state.cacheAvailable = true;
  mocks.cache.match.mockResolvedValue(undefined);
  mocks.cache.put.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("young event image route", () => {
  it("streams the cached object from R2 with immutable cache headers", async () => {
    mocks.bucket.head.mockResolvedValue({
      size: 5,
      etag: "r2-etag",
      httpMetadata: { contentType: "image/jpeg" },
    });
    mocks.bucket.get.mockResolvedValue({
      size: 5,
      body: stream("bytes"),
      httpMetadata: { contentType: "image/jpeg" },
    });

    const response = await getYoungEventImageRoute(new Request(ROUTE_URL), {
      youngId: "42",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=31536000, immutable, no-transform",
    );
    expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(response.headers.get("ETag")).toBe('"r2-etag"');
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("Content-Length")).toBe("5");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    await expect(response.text()).resolves.toBe("bytes");
    expect(mocks.bucket.head).toHaveBeenCalledWith(R2_KEY);
    expect(mocks.fetchMock).not.toHaveBeenCalled();
    expect(mocks.bucket.put).not.toHaveBeenCalled();
  });

  it("answers 304 when If-None-Match matches the cached object", async () => {
    mocks.bucket.head.mockResolvedValue({ size: 5, etag: '"r2-etag"' });

    const response = await getYoungEventImageRoute(
      new Request(ROUTE_URL, { headers: { "If-None-Match": 'W/"r2-etag"' } }),
      { youngId: "42" },
    );

    expect(response.status).toBe(304);
    expect(mocks.bucket.get).not.toHaveBeenCalled();
    expect(mocks.fetchMock).not.toHaveBeenCalled();
  });

  it("fetches the origin on a cache miss, stores via defer, and serves the bytes", async () => {
    mocks.bucket.head.mockResolvedValue(null);
    const deferred: Promise<unknown>[] = [];
    mocks.fetchMock.mockResolvedValue(
      new Response(stream("origin-bytes"), {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      }),
    );
    mocks.bucket.put.mockResolvedValue(undefined);

    const response = await getYoungEventImageRoute(
      new Request(ROUTE_URL),
      { youngId: "42" },
      { defer: (promise) => deferred.push(promise) },
    );

    expect(response.status).toBe(200);
    expect(mocks.fetchMock).toHaveBeenCalledWith(ORIGIN_URL);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("Cache-Control")).toContain("immutable");
    await expect(response.text()).resolves.toBe("origin-bytes");

    expect(mocks.bucket.put).toHaveBeenCalledWith(
      R2_KEY,
      expect.any(ArrayBuffer),
      { httpMetadata: { contentType: "image/jpeg" } },
    );
    // Deferred: the R2 cache write and the Cache API response write.
    expect(deferred).toHaveLength(2);
    await expect(Promise.all(deferred)).resolves.toHaveLength(2);
    expect(mocks.cache.put).toHaveBeenCalledTimes(1);
    const [cacheRequest, cacheResponse] = mocks.cache.put.mock.calls[0];
    expect(cacheRequest.url).toBe(CACHE_KEY_URL);
    expect(cacheResponse.status).toBe(200);
  });

  it("falls back to an extension-based content type when the origin omits it", async () => {
    mocks.bucket.head.mockResolvedValue(null);
    mocks.fetchMock.mockResolvedValue(
      new Response(stream("png-bytes"), { status: 200 }),
    );
    mocks.youngEventFindUnique.mockResolvedValue(
      eventWithImage("group1/M00/31/B5/poster.PNG"),
    );

    const response = await getYoungEventImageRoute(new Request(ROUTE_URL), {
      youngId: "42",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(mocks.bucket.put).toHaveBeenCalledWith(
      "young-events/images/group1/M00/31/B5/poster.PNG",
      expect.any(ArrayBuffer),
      { httpMetadata: { contentType: "image/png" } },
    );
  });

  it("responds 502 and stores nothing in R2 when the origin fails", async () => {
    mocks.bucket.head.mockResolvedValue(null);
    mocks.fetchMock.mockResolvedValue(new Response("nope", { status: 404 }));

    const response = await getYoungEventImageRoute(new Request(ROUTE_URL), {
      youngId: "42",
    });

    expect(response.status).toBe(502);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
    const body = (await response.json()) as { error?: string };
    expect(typeof body.error).toBe("string");
    expect(mocks.bucket.put).not.toHaveBeenCalled();

    mocks.fetchMock.mockRejectedValue(new Error("network down"));
    const networkFailure = await getYoungEventImageRoute(
      new Request(ROUTE_URL),
      { youngId: "42" },
    );
    expect(networkFailure.status).toBe(502);
    expect(mocks.bucket.put).not.toHaveBeenCalled();
  });

  it("rejects a non-image origin content type without caching it", async () => {
    mocks.bucket.head.mockResolvedValue(null);
    mocks.fetchMock.mockResolvedValue(
      new Response(stream("<html>error page</html>"), {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }),
    );

    const response = await getYoungEventImageRoute(new Request(ROUTE_URL), {
      youngId: "42",
    });

    expect(response.status).toBe(502);
    expect(mocks.bucket.put).not.toHaveBeenCalled();
  });

  it("rejects an origin response whose Content-Length exceeds the cap", async () => {
    mocks.bucket.head.mockResolvedValue(null);
    mocks.fetchMock.mockResolvedValue(
      new Response(stream("tiny"), {
        status: 200,
        headers: {
          "Content-Type": "image/jpeg",
          "Content-Length": String(YOUNG_EVENT_IMAGE_MAX_BYTES + 1),
        },
      }),
    );

    const response = await getYoungEventImageRoute(new Request(ROUTE_URL), {
      youngId: "42",
    });

    expect(response.status).toBe(502);
    expect(mocks.bucket.put).not.toHaveBeenCalled();
  });

  it("rejects an origin body that exceeds the cap after reading", async () => {
    mocks.bucket.head.mockResolvedValue(null);
    mocks.fetchMock.mockResolvedValue(
      new Response(stream("x".repeat(YOUNG_EVENT_IMAGE_MAX_BYTES + 1)), {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      }),
    );

    const response = await getYoungEventImageRoute(new Request(ROUTE_URL), {
      youngId: "42",
    });

    expect(response.status).toBe(502);
    expect(mocks.bucket.put).not.toHaveBeenCalled();
  });

  it("responds 404 for an unknown youngId", async () => {
    mocks.youngEventFindUnique.mockResolvedValue(null);

    const response = await getYoungEventImageRoute(new Request(ROUTE_URL), {
      youngId: "missing",
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
    const body = (await response.json()) as { error?: string };
    expect(typeof body.error).toBe("string");
    expect(mocks.bucket.head).not.toHaveBeenCalled();
  });

  it("responds 404 when the event has no image", async () => {
    mocks.youngEventFindUnique.mockResolvedValue(eventWithImage(null));

    const response = await getYoungEventImageRoute(new Request(ROUTE_URL), {
      youngId: "42",
    });

    expect(response.status).toBe(404);
    expect(mocks.bucket.head).not.toHaveBeenCalled();
  });

  it.each([
    "https://evil.example/x.jpg",
    "//evil.example/x.jpg",
    "/etc/passwd",
    "group1/../../secret",
    "..",
    "group1\\M00\\x.jpg",
    "group1/M00/../x.jpg",
  ])("rejects the unsafe stored path %j without touching R2", async (raw) => {
    mocks.youngEventFindUnique.mockResolvedValue(eventWithImage(raw));

    const response = await getYoungEventImageRoute(new Request(ROUTE_URL), {
      youngId: "42",
    });

    expect(response.status).toBe(404);
    expect(mocks.bucket.head).not.toHaveBeenCalled();
    expect(mocks.fetchMock).not.toHaveBeenCalled();
  });

  it("serves a repeat request from the Cache API without touching the DB, R2, or the origin", async () => {
    mocks.cache.match.mockResolvedValue(
      new Response(stream("cached-bytes"), {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=31536000, immutable, no-transform",
          "Content-Type": "image/jpeg",
          ETag: '"cached-etag"',
        },
      }),
    );

    const response = await getYoungEventImageRoute(new Request(ROUTE_URL), {
      youngId: "42",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("ETag")).toBe('"cached-etag"');
    await expect(response.text()).resolves.toBe("cached-bytes");
    expect(mocks.cache.match.mock.calls[0][0].url).toBe(CACHE_KEY_URL);
    expect(mocks.youngEventFindUnique).not.toHaveBeenCalled();
    expect(mocks.bucket.head).not.toHaveBeenCalled();
    expect(mocks.fetchMock).not.toHaveBeenCalled();
  });

  it("answers 304 from the Cache API when If-None-Match matches the cached ETag", async () => {
    mocks.cache.match.mockResolvedValue(
      new Response(stream("cached-bytes"), {
        status: 200,
        headers: { ETag: '"cached-etag"', "Content-Length": "12" },
      }),
    );

    const response = await getYoungEventImageRoute(
      new Request(ROUTE_URL, {
        headers: { "If-None-Match": 'W/"cached-etag"' },
      }),
      { youngId: "42" },
    );

    expect(response.status).toBe(304);
    expect(response.headers.get("Content-Length")).toBeNull();
    expect(mocks.youngEventFindUnique).not.toHaveBeenCalled();
  });

  it("caches 404 and 502 responses in the Cache API with their header TTLs", async () => {
    mocks.youngEventFindUnique.mockResolvedValue(null);
    const missing = await getYoungEventImageRoute(new Request(ROUTE_URL), {
      youngId: "missing",
    });
    expect(missing.status).toBe(404);
    expect(mocks.cache.put).toHaveBeenCalledTimes(1);
    const [notFoundRequest, notFoundResponse] = mocks.cache.put.mock.calls[0];
    expect(notFoundRequest.url).toBe(
      "https://life.test/_life-ustc-internal-cache/young-event-image/v1/missing",
    );
    expect(notFoundResponse.status).toBe(404);
    expect(notFoundResponse.headers.get("Cache-Control")).toBe(
      "public, max-age=300",
    );

    mocks.youngEventFindUnique.mockResolvedValue(eventWithImage());
    mocks.bucket.head.mockResolvedValue(null);
    mocks.fetchMock.mockResolvedValue(new Response("nope", { status: 404 }));
    const failure = await getYoungEventImageRoute(new Request(ROUTE_URL), {
      youngId: "42",
    });
    expect(failure.status).toBe(502);
    expect(mocks.cache.put).toHaveBeenCalledTimes(2);
    const [, failureResponse] = mocks.cache.put.mock.calls[1];
    expect(failureResponse.status).toBe(502);
    expect(failureResponse.headers.get("Cache-Control")).toBe(
      "public, max-age=60",
    );
  });

  it("does not cache the 503 storage-unavailable response", async () => {
    mocks.state.bucketAvailable = false;

    const response = await getYoungEventImageRoute(new Request(ROUTE_URL), {
      youngId: "42",
    });

    expect(response.status).toBe(503);
    expect(mocks.cache.put).not.toHaveBeenCalled();
  });

  it("still serves the image when the Cache API is unavailable", async () => {
    mocks.state.cacheAvailable = false;
    mocks.bucket.head.mockResolvedValue({
      size: 5,
      etag: "r2-etag",
      httpMetadata: { contentType: "image/jpeg" },
    });
    mocks.bucket.get.mockResolvedValue({
      size: 5,
      body: stream("bytes"),
      httpMetadata: { contentType: "image/jpeg" },
    });

    const response = await getYoungEventImageRoute(new Request(ROUTE_URL), {
      youngId: "42",
    });

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("bytes");
  });

  it("logs an error when the deferred R2 cache write fails", async () => {
    mocks.bucket.head.mockResolvedValue(null);
    mocks.fetchMock.mockResolvedValue(
      new Response(stream("origin-bytes"), {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      }),
    );
    const failure = new Error("r2 write failed");
    mocks.bucket.put.mockRejectedValue(failure);
    const deferred: Promise<unknown>[] = [];

    const response = await getYoungEventImageRoute(
      new Request(ROUTE_URL),
      { youngId: "42" },
      { defer: (promise) => deferred.push(promise) },
    );

    expect(response.status).toBe(200);
    await expect(Promise.all(deferred)).resolves.toBeDefined();
    expect(mocks.logAppEvent).toHaveBeenCalledWith(
      "error",
      "Failed to cache young event image in R2",
      expect.objectContaining({ source: "young-event-image", youngId: "42" }),
      failure,
    );
  });

  it("logs an error when the Cache API write fails and still serves the image", async () => {
    mocks.bucket.head.mockResolvedValue(null);
    mocks.fetchMock.mockResolvedValue(
      new Response(stream("origin-bytes"), {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      }),
    );
    mocks.bucket.put.mockResolvedValue(undefined);
    const failure = new Error("cache put failed");
    mocks.cache.put.mockRejectedValue(failure);

    const response = await getYoungEventImageRoute(new Request(ROUTE_URL), {
      youngId: "42",
    });

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("origin-bytes");
    expect(mocks.logAppEvent).toHaveBeenCalledWith(
      "error",
      "Failed to cache young event image response",
      expect.objectContaining({ source: "young-event-image" }),
      failure,
    );
  });
});
