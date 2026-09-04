import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  youngEventFindUnique: vi.fn(),
  bucket: {
    head: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
  },
  fetchMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { youngEvent: { findUnique: mocks.youngEventFindUnique } },
}));

vi.mock("@/lib/adapters/cloudflare-runtime", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/lib/adapters/cloudflare-runtime")
  >()),
  getCloudflareR2PublicationsBucket: () => mocks.bucket,
}));

import { YOUNG_EVENT_IMAGE_MAX_BYTES } from "@/features/young/server/young-event-image-service";
import { getYoungEventImageRoute } from "@/lib/api/routes/young-event-routes";

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
    expect(deferred).toHaveLength(1);
    await expect(deferred[0]).resolves.toBeUndefined();
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

  it("responds 502 and caches nothing when the origin fails", async () => {
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
});
