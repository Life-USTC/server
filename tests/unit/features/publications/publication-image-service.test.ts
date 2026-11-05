import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
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

describe("publication image origin diagnostics", () => {
  const secret = "private-origin-credential";
  const cases: Array<{
    reason: string;
    response: () => Response;
    upstreamStatus?: number;
  }> = [
    {
      reason: "upstream_status",
      upstreamStatus: 403,
      response: () => new Response(secret, { status: 403 }),
    },
    {
      reason: "content_type",
      response: () =>
        new Response(secret, { headers: { "Content-Type": "text/html" } }),
    },
    {
      reason: "empty_body",
      response: () =>
        new Response(null, { headers: { "Content-Type": "image/png" } }),
    },
    {
      reason: "response_too_large",
      response: () =>
        new Response(secret, {
          headers: {
            "Content-Type": "image/png",
            "Content-Length": String(PUBLICATION_IMAGE_MAX_BYTES + 1),
          },
        }),
    },
    {
      reason: "redirect_disallowed",
      response: () =>
        new Response(null, {
          status: 302,
          headers: { Location: `https://forbidden.example/${secret}` },
        }),
    },
    {
      reason: "redirect_missing_location",
      response: () => new Response(null, { status: 302 }),
    },
    {
      reason: "redirect_invalid",
      response: () =>
        new Response(null, {
          status: 302,
          headers: { Location: "http://[invalid" },
        }),
    },
    {
      reason: "redirect_limit",
      response: () =>
        new Response(null, {
          status: 302,
          headers: { Location: `/loop?token=${secret}` },
        }),
    },
    {
      reason: "fetch_failed",
      response: () => {
        throw new Error(
          `Network failure at https://private.example/?token=${secret}`,
        );
      },
    },
    {
      reason: "body_read_failed",
      response: () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new Error(`Body contains ${secret}`));
            },
          }),
          { headers: { "Content-Type": "image/png" } },
        ),
    },
  ];

  it.each(cases)(
    "logs $reason without exposing upstream data",
    async ({ reason, response, upstreamStatus }) => {
      vi.stubEnv("NODE_ENV", "production");
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      const url = `https://news.example.test/private.png?token=${secret}`;
      const hash = await hashUrl(url);
      mocks.imageSourceFindUnique.mockResolvedValue(sourceRecord(url, hash));
      mocks.fetchMock.mockImplementation(async () => response());

      const result = await getPublicPublicationImageRoute(
        new Request(`https://life.test/api/publications/images/${hash}`),
        { hash },
      );
      expect(result.status).toBe(502);
      expect(result.headers.get("Cache-Control")).toBe("no-store");
      await expect(result.json()).resolves.toEqual({
        error: "Failed to fetch publication image from origin",
      });
      expect(mocks.bucket.put).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(String(log.mock.calls[0]?.[0]));
      expect(payload).toMatchObject({
        event: "publication.image.origin-failure",
        originFailureReason: reason,
        status: 502,
      });
      expect(payload.upstreamStatus).toBe(upstreamStatus);
      const serialized = JSON.stringify(payload);
      expect(serialized).not.toContain(secret);
      expect(serialized).not.toContain(hash);
      expect(serialized).not.toContain("https://");
      expect(serialized).not.toContain("Body contains");
    },
  );

  it.each(["fetch", "body"] as const)(
    "distinguishes the existing %s timeout without extending its deadline",
    async (phase) => {
      vi.stubEnv("NODE_ENV", "production");
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      const url = "https://news.example.test/timeout.png";
      const hash = await hashUrl(url);
      mocks.imageSourceFindUnique.mockResolvedValue(sourceRecord(url, hash));
      const started = Promise.withResolvers<AbortSignal>();
      mocks.fetchMock.mockImplementation((_url: URL, options: RequestInit) => {
        const signal = options.signal as AbortSignal;
        started.resolve(signal);
        if (phase === "body") {
          return Promise.resolve(
            new Response(
              new ReadableStream({
                start(controller) {
                  signal.addEventListener(
                    "abort",
                    () =>
                      controller.error(new DOMException(secret, "AbortError")),
                    { once: true },
                  );
                },
              }),
              { headers: { "Content-Type": "image/png" } },
            ),
          );
        }
        return new Promise<Response>((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => reject(new DOMException(secret, "AbortError")),
            { once: true },
          );
        });
      });
      vi.useFakeTimers();
      const pending = getPublicPublicationImageRoute(
        new Request(`https://life.test/api/publications/images/${hash}`),
        { hash },
      );
      const signal = await started.promise;
      await vi.advanceTimersByTimeAsync(9_999);
      expect(signal.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      const response = await pending;
      expect(response.status).toBe(502);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      await response.body?.cancel();
      expect(mocks.bucket.put).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledTimes(1);
      expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toMatchObject({
        originFailureReason: "timeout",
      });
      expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
    },
  );
});
