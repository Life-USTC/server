import { afterEach, beforeEach, describe, expect, it, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  youngEventFindUnique: vi.fn(),
  bucket: {
    head: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
  },
  state: {
    bucketAvailable: true,
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
  getCloudflareR2PublicationsBucket: () =>
    mocks.state.bucketAvailable ? mocks.bucket : undefined,
}));

vi.mock("@/lib/log/app-logger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/log/app-logger")>()),
  logAppEvent: mocks.logAppEvent,
}));

import { YOUNG_EVENT_IMAGE_MAX_BYTES } from "@/features/young/server/young-event-image-service";
import {
  getYoungEventImageByPathRoute,
  getYoungEventImageRoute,
} from "@/lib/api/routes/young-event-routes";

const PIC_PATH = "group1/M00/31/B5/wKgUEWpR3ciAJX_MAABnEoFLBaI860.jpg";
const R2_KEY = `young-events/images/${PIC_PATH}`;
const ORIGIN_URL = `https://young.ustc.edu.cn/login/${PIC_PATH}`;
const ROUTE_URL = "https://life.test/api/catalog/young-events/42/image";

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
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function getPosterBytes(
  request: Request,
  params: { youngId: string },
  options: { defer?: (promise: Promise<unknown>) => void } = {},
) {
  const alias = await getYoungEventImageRoute(request, params);
  if (alias.status !== 302) return alias;
  const target = new URL(String(alias.headers.get("Location")), request.url);
  return getYoungEventImageByPathRoute(
    new Request(target, { headers: request.headers }),
    {
      path: target.pathname.slice("/api/catalog/young-events/images/".length),
    },
    options,
  );
}

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

    const response = await getPosterBytes(new Request(ROUTE_URL), {
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

    const response = await getPosterBytes(
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

    const response = await getPosterBytes(
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
    // Only the immutable representation is written to R2.
    expect(deferred).toHaveLength(1);
    await expect(Promise.all(deferred)).resolves.toHaveLength(1);
  });

  it("falls back to an extension-based content type when the origin omits it", async () => {
    mocks.bucket.head.mockResolvedValue(null);
    mocks.fetchMock.mockResolvedValue(
      new Response(stream("png-bytes"), { status: 200 }),
    );
    mocks.youngEventFindUnique.mockResolvedValue(
      eventWithImage("group1/M00/31/B5/poster.PNG"),
    );

    const response = await getPosterBytes(new Request(ROUTE_URL), {
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

    const response = await getPosterBytes(new Request(ROUTE_URL), {
      youngId: "42",
    });

    expect(response.status).toBe(502);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
    const body = (await response.json()) as { error?: string };
    expect(typeof body.error).toBe("string");
    expect(mocks.bucket.put).not.toHaveBeenCalled();

    mocks.fetchMock.mockRejectedValue(new Error("network down"));
    const networkFailure = await getPosterBytes(new Request(ROUTE_URL), {
      youngId: "42",
    });
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

    const response = await getPosterBytes(new Request(ROUTE_URL), {
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

    const response = await getPosterBytes(new Request(ROUTE_URL), {
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

    const response = await getPosterBytes(new Request(ROUTE_URL), {
      youngId: "42",
    });

    expect(response.status).toBe(502);
    expect(mocks.bucket.put).not.toHaveBeenCalled();
  });

  it("responds 404 for an unknown youngId", async () => {
    mocks.youngEventFindUnique.mockResolvedValue(null);

    const response = await getPosterBytes(new Request(ROUTE_URL), {
      youngId: "missing",
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = (await response.json()) as { error?: string };
    expect(typeof body.error).toBe("string");
    expect(mocks.bucket.head).not.toHaveBeenCalled();
  });

  it("responds 404 when the event has no image", async () => {
    mocks.youngEventFindUnique.mockResolvedValue(eventWithImage(null));

    const response = await getPosterBytes(new Request(ROUTE_URL), {
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

    const response = await getPosterBytes(new Request(ROUTE_URL), {
      youngId: "42",
    });

    expect(response.status).toBe(404);
    expect(mocks.bucket.head).not.toHaveBeenCalled();
    expect(mocks.fetchMock).not.toHaveBeenCalled();
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

    const response = await getPosterBytes(
      new Request(ROUTE_URL),
      { youngId: "42" },
      { defer: (promise) => deferred.push(promise) },
    );

    expect(response.status).toBe(200);
    await expect(Promise.all(deferred)).resolves.toBeDefined();
    expect(mocks.logAppEvent).toHaveBeenCalledWith(
      "error",
      "Failed to cache young event image in R2",
      expect.objectContaining({
        source: "young-event-image",
        imagePath: PIC_PATH,
      }),
      failure,
    );
  });
});

describe("young event image by-path route", () => {
  const BY_PATH_URL = `https://life.test/api/catalog/young-events/images/${PIC_PATH}`;

  it("serves R2-cached bytes for an arbitrary normalized image path", async () => {
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

    const response = await getYoungEventImageByPathRoute(
      new Request(BY_PATH_URL),
      { path: PIC_PATH },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("Cache-Control")).toContain("immutable");
    await expect(response.text()).resolves.toBe("bytes");
    expect(mocks.bucket.head).toHaveBeenCalledWith(R2_KEY);
    // Image bytes are event-independent, so no event lookup happens.
    expect(mocks.youngEventFindUnique).not.toHaveBeenCalled();
  });

  it("fetches and caches the origin on a miss", async () => {
    mocks.bucket.head.mockResolvedValue(null);
    mocks.fetchMock.mockResolvedValue(
      new Response(stream("origin-bytes"), {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      }),
    );
    mocks.bucket.put.mockResolvedValue(undefined);

    const response = await getYoungEventImageByPathRoute(
      new Request(BY_PATH_URL),
      { path: PIC_PATH },
    );

    expect(response.status).toBe(200);
    expect(mocks.fetchMock).toHaveBeenCalledWith(ORIGIN_URL);
    expect(mocks.bucket.put).toHaveBeenCalledWith(
      R2_KEY,
      expect.any(ArrayBuffer),
      { httpMetadata: { contentType: "image/jpeg" } },
    );
  });

  it.each(["../secret.jpg", "group1/../../secret", "group1\\M00\\x.jpg", ""])(
    "rejects the unsafe path %j without touching R2",
    async (path) => {
      const response = await getYoungEventImageByPathRoute(
        new Request(BY_PATH_URL),
        { path },
      );

      expect(response.status).toBe(404);
      expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
      expect(mocks.bucket.head).not.toHaveBeenCalled();
      expect(mocks.fetchMock).not.toHaveBeenCalled();
    },
  );

  it("responds 503 when the bucket binding is missing", async () => {
    mocks.state.bucketAvailable = false;

    const response = await getYoungEventImageByPathRoute(
      new Request(BY_PATH_URL),
      { path: PIC_PATH },
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("60");
  });

  it("responds 502 when the origin fails", async () => {
    mocks.bucket.head.mockResolvedValue(null);
    mocks.fetchMock.mockResolvedValue(new Response("nope", { status: 404 }));

    const response = await getYoungEventImageByPathRoute(
      new Request(BY_PATH_URL),
      { path: PIC_PATH },
    );

    expect(response.status).toBe(502);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(mocks.bucket.put).not.toHaveBeenCalled();
  });
});

test("young-event.image-proxy-cached", async () => {
  const firstPath = PIC_PATH;
  const secondPath = "group1/M00/31/B5/new-poster.jpg";
  mocks.bucket.head.mockImplementation(async (key: string) => ({
    size: 5,
    etag: key,
    httpMetadata: { contentType: "image/jpeg" },
  }));
  mocks.bucket.get.mockImplementation(async (key: string) => ({
    size: 5,
    body: stream(key.endsWith("new-poster.jpg") ? "new!!" : "old!!"),
    httpMetadata: { contentType: "image/jpeg" },
  }));
  const locations = [];
  for (const [path, expected] of [
    [firstPath, "old!!"],
    [secondPath, "new!!"],
  ]) {
    mocks.youngEventFindUnique.mockResolvedValue(eventWithImage(path));
    const alias = await getYoungEventImageRoute(new Request(ROUTE_URL), {
      youngId: "42",
    });
    expect(alias.status).toBe(302);
    expect(alias.headers.get("Cache-Control")).toBe("no-store");
    expect(alias.headers.get("Cloudflare-CDN-Cache-Control")).toBe("no-store");
    const location = alias.headers.get("Location");
    expect(location).toBe(`/api/catalog/young-events/images/${path}`);
    locations.push(location);
    const image = await getYoungEventImageByPathRoute(
      new Request(new URL(String(location), ROUTE_URL)),
      { path },
    );
    expect(image.status).toBe(200);
    expect(image.headers.get("Cache-Control")).toContain("immutable");
    expect(await image.text()).toBe(expected);
    const etag = image.headers.get("ETag");
    expect(etag).toBe(`"young-events/images/${path}"`);
    const unchanged = await getYoungEventImageByPathRoute(
      new Request(new URL(String(location), ROUTE_URL), {
        headers: { "If-None-Match": String(etag) },
      }),
      { path },
    );
    expect(unchanged.status).toBe(304);
  }
  expect(locations[0]).not.toBe(locations[1]);
  expect(mocks.fetchMock).not.toHaveBeenCalled();
});
