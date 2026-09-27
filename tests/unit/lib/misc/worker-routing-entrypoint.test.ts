import { readFileSync } from "node:fs";
import { parse } from "jsonc-parser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  appFetchMock,
  maintainAuditLogRetentionMock,
  cleanupExpiredAuthRecordsMock,
  handleAuditLogWriteBatchMock,
  handleCalendarExportRebuildBatchMock,
  logAppEventMock,
  runWithCloudflareRuntimeEnvMock,
  setCloudflareRequestContextMock,
} = vi.hoisted(() => ({
  appFetchMock: vi.fn(),
  maintainAuditLogRetentionMock: vi.fn(),
  cleanupExpiredAuthRecordsMock: vi.fn(),
  handleAuditLogWriteBatchMock: vi.fn(),
  handleCalendarExportRebuildBatchMock: vi.fn(),
  logAppEventMock: vi.fn(),
  runWithCloudflareRuntimeEnvMock: vi.fn(
    (_env: unknown, callback: () => unknown) => callback(),
  ),
  setCloudflareRequestContextMock: vi.fn(),
}));

vi.mock("@/features/weather/server/weather-cache", () => ({
  readWeatherCache: vi.fn(),
  writeWeatherCache: vi.fn(async () => undefined),
}));
vi.mock("@/features/weather/server/weather-history", () => ({
  writeWeatherHistory: vi.fn(async () => undefined),
}));

vi.mock("@/features/admin/server/audit-retention", () => ({
  maintainAuditLogRetention: maintainAuditLogRetentionMock,
  maintainOAuthGrantUsageRetention: vi.fn(async () => ({
    oauthRetentionComplete: true,
  })),
  maintainObservabilityRetention: vi.fn(async () => ({
    observabilityRetentionComplete: true,
  })),
}));
vi.mock("@/features/auth/server/auth-record-cleanup", () => ({
  cleanupExpiredAuthRecords: cleanupExpiredAuthRecordsMock,
}));
vi.mock("cloudflare:workers", () => ({
  WorkerEntrypoint: class {},
}));
vi.mock("life-ustc-sveltekit-worker", () => ({
  default: { fetch: appFetchMock },
}));
vi.mock("@/lib/audit/audit-log-queue", () => ({
  handleAuditLogWriteBatch: handleAuditLogWriteBatchMock,
}));
vi.mock("@/features/calendar/server/calendar-export-rebuild", () => ({
  handleCalendarExportRebuildBatch: handleCalendarExportRebuildBatchMock,
}));
vi.mock("@/lib/adapters/cloudflare-runtime", () => ({
  getCloudflareAnalyticsEngineDataset: () => undefined,
  getCloudflareRuntimeEnvInput: () => ({}),
  runWithCloudflareRuntimeEnv: runWithCloudflareRuntimeEnvMock,
  setCloudflareRequestContext: setCloudflareRequestContextMock,
}));
vi.mock("@/lib/log/app-logger", () => ({
  logAppEvent: logAppEventMock,
}));

import {
  PUBLIC_SSR_CACHE_PURGE_PATH,
  PUBLIC_SSR_CACHE_PURGE_SECRET_ENV,
  PUBLIC_SSR_CACHE_PURGE_SECRET_HEADER,
} from "@/lib/cloudflare/public-ssr-cache-purge";
import {
  INTERNAL_REQUEST_ID_HEADER,
  normalizePublicSsrObservedRoute,
} from "@/lib/log/worker-entrypoint-observability";
import worker, { PublicSsr } from "@/worker";

const PURGE_SECRET = "edge-cache-purge-secret-value";

async function withHtmlRewriter<T>(callback: () => Promise<T>) {
  const globalScope = globalThis as typeof globalThis & {
    HTMLRewriter?: unknown;
  };
  const previousHtmlRewriter = globalScope.HTMLRewriter;
  globalScope.HTMLRewriter = class {
    on() {
      return this;
    }

    transform(response: Response) {
      return response;
    }
  };
  try {
    return await callback();
  } finally {
    if (previousHtmlRewriter === undefined) {
      delete globalScope.HTMLRewriter;
    } else {
      globalScope.HTMLRewriter = previousHtmlRewriter;
    }
  }
}

/**
 * Mirror the runtime contract of `ctx.exports.<Entrypoint>(...)`: the binding
 * is a constructor that *requires* an Options argument. Calling it bare throws
 * `TypeError: parameter 1 is not of type 'Options'` before any RPC is
 * dispatched — measured against workerd with a minimal repro, not assumed.
 *
 * A stub that ignores its arguments accepts both `PublicSsr()` and
 * `PublicSsr({})`, which is precisely how a bare purge call reached production
 * while every test stayed green. Keep new `exports` stubs on this helper.
 */
function publicSsrExportStub<T>(build: () => T) {
  return vi.fn((...args: unknown[]): T => {
    if (args.length === 0 || typeof args[0] !== "object" || args[0] === null) {
      throw new TypeError("parameter 1 is not of type 'Options'");
    }
    return build();
  });
}

describe("Worker routing entrypoint", () => {
  beforeEach(() => {
    appFetchMock.mockReset();
    handleAuditLogWriteBatchMock.mockReset();
    handleCalendarExportRebuildBatchMock.mockReset();
    logAppEventMock.mockReset();
    runWithCloudflareRuntimeEnvMock.mockClear();
    setCloudflareRequestContextMock.mockClear();
    appFetchMock.mockResolvedValue(new Response("dynamic", { status: 200 }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults early dynamic redirects to private caching without changing their payload or cookies", async () => {
    for (const [status, body, contentType, location] of [
      [303, null, null, "/account/welcome?callbackUrl=%2F"],
      [
        200,
        JSON.stringify({ type: "redirect", location: "/account/welcome" }),
        "application/json",
        null,
      ],
    ] as const) {
      for (const policy of ["missing", "private", "public"]) {
        const headers = new Headers({
          "Set-Cookie": "session=renewed; Path=/; HttpOnly",
        });
        if (contentType) headers.set("Content-Type", contentType);
        if (location) headers.set("Location", location);
        if (policy !== "missing") {
          headers.set(
            "Cache-Control",
            policy === "public" ? "public, max-age=120" : "private, no-store",
          );
          headers.set("Cloudflare-CDN-Cache-Control", "public, max-age=240");
        }
        appFetchMock.mockResolvedValueOnce(
          new Response(body, { status, headers }),
        );
        const response = await worker.fetch(
          new Request("https://life-ustc.test/__data.json", {
            headers: { cookie: "better-auth.session_token=session" },
          }),
          {},
          { waitUntil: vi.fn() },
        );
        expect(response.status).toBe(status);
        expect(response.headers.get("Location")).toBe(location);
        expect(response.headers.get("Set-Cookie")).toBe(
          headers.get("Set-Cookie"),
        );
        expect(response.headers.get("Content-Type")).toBe(contentType);
        expect(response.headers.get("Cache-Control")).toBe(
          policy === "public" ? "public, max-age=120" : "private, no-store",
        );
        expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
          policy === "public" ? "public, max-age=240" : "no-store",
        );
        expect(await response.text()).toBe(body ?? "");
      }
    }
  });

  it("correlates and sanitizes dynamic sign-in requests without changing method or body", async () => {
    let forwardedBody: string | undefined;
    appFetchMock.mockImplementationOnce(async (forwardedRequest: Request) => {
      forwardedBody = await forwardedRequest.text();
      return new Response("dynamic", { status: 200 });
    });

    const response = await worker.fetch(
      new Request(
        "https://life-ustc.test/account/sign-in?callbackUrl=%2Foauth%2Fauthorize%3Fstate%3Dsecret",
        {
          body: "provider=google",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            "x-life-public-ssr": "1",
            "x-life-public-ssr-locale": "en-us",
            "x-life-public-ssr-mode": "page",
            [INTERNAL_REQUEST_ID_HEADER]: "client-controlled-internal-id",
            "x-request-id": "client-controlled-id",
          },
          method: "POST",
        },
      ),
      {},
      { waitUntil: vi.fn() },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/i);
    const [forwardedRequest] = appFetchMock.mock.calls[0] ?? [];
    expect(forwardedRequest).toBeInstanceOf(Request);
    expect(forwardedRequest.method).toBe("POST");
    expect(forwardedBody).toBe("provider=google");
    expect(forwardedRequest.headers.get(INTERNAL_REQUEST_ID_HEADER)).toBe(
      response.headers.get("x-request-id"),
    );
    expect(forwardedRequest.headers.get("x-request-id")).toBeNull();
    expect(forwardedRequest.headers.get("x-life-public-ssr")).toBeNull();
    expect(forwardedRequest.headers.get("x-life-public-ssr-locale")).toBeNull();
    expect(forwardedRequest.headers.get("x-life-public-ssr-mode")).toBeNull();
    expect(setCloudflareRequestContextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: response.headers.get("x-request-id"),
      }),
    );
    expect(JSON.stringify(logAppEventMock.mock.calls)).not.toContain("secret");
    expect(logAppEventMock).toHaveBeenCalledWith(
      "info",
      "edge.request.finish",
      expect.objectContaining({
        cacheOutcome: "dynamic",
        method: "POST",
        requestClass: "dynamic",
        requestId: response.headers.get("x-request-id"),
        status: 200,
      }),
    );
    expect(logAppEventMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logAppEventMock.mock.calls)).not.toContain(
      "client-controlled-id",
    );
    expect(JSON.stringify(logAppEventMock.mock.calls)).not.toContain(
      "client-controlled-internal-id",
    );
  });

  it("forwards the edge request ID when the client supplies no correlation headers", async () => {
    const request = new Request(
      "https://life-ustc.test/api/workspace/subscriptions",
      {
        body: JSON.stringify({ sectionIds: [1] }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      },
    );
    let trustedContextRequestId: string | undefined;
    setCloudflareRequestContextMock.mockImplementationOnce(
      ({ requestId }: { requestId: string }) => {
        trustedContextRequestId = requestId;
      },
    );
    appFetchMock.mockImplementationOnce(async (forwardedRequest: Request) => {
      expect(forwardedRequest.method).toBe("PATCH");
      expect(forwardedRequest.headers.get(INTERNAL_REQUEST_ID_HEADER)).toBe(
        trustedContextRequestId,
      );
      expect(trustedContextRequestId).toMatch(/^[0-9a-f-]{36}$/i);
      return new Response("unauthorized", { status: 401 });
    });

    const response = await worker.fetch(request, {}, { waitUntil: vi.fn() });

    expect(response.status).toBe(401);
    expect(
      appFetchMock.mock.calls[0]?.[0].headers.get(INTERNAL_REQUEST_ID_HEADER),
    ).toBe(response.headers.get("x-request-id"));
    expect(trustedContextRequestId).toBe(response.headers.get("x-request-id"));
    expect(logAppEventMock).toHaveBeenCalledWith(
      "info",
      "edge.request.finish",
      expect.objectContaining({
        method: "PATCH",
        requestId: response.headers.get("x-request-id"),
        status: 401,
      }),
    );
  });

  it("cancels an unread body after early rejection without creating a second stream branch", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("unread body"));
      },
      cancel,
    });
    appFetchMock.mockResolvedValueOnce(
      new Response("unauthorized", { status: 401 }),
    );
    const requestInit = { body, method: "PUT", duplex: "half" };
    const request = new Request(
      "https://life-ustc.test/api/workspace/uploads/object",
      requestInit,
    );
    const response = await worker.fetch(request, {}, { waitUntil: vi.fn() });
    expect(response.status).toBe(401);
    expect(cancel).toHaveBeenCalledExactlyOnceWith("request body released");
  });

  it("interface-hierarchy.locale-caching-and-seo-5", async () => {
    const dispatches: Array<{ key: string; locale: string | null }> = [];
    const publicSsrFetch = vi.fn(
      async (request: Request, options: { cf: { cacheKey: string } }) => {
        dispatches.push({
          key: options.cf.cacheKey,
          locale: request.headers.get("x-life-public-ssr-locale"),
        });
        return new Response("public", {
          headers: { "content-type": "text/html" },
        });
      },
    );
    const context = {
      exports: {
        PublicSsr: publicSsrExportStub(() => ({ fetch: publicSsrFetch })),
      },
      waitUntil: vi.fn(),
    };
    for (const path of [
      "/catalog/courses",
      "/catalog/sections/159446",
      "/catalog/young-events",
    ]) {
      const keys = new Map<string, string>();
      const scenarios: Array<{
        headers: Record<string, string>;
        locale: string;
      }> = [
        { headers: {}, locale: "zh-cn" },
        { headers: { "accept-language": "en-GB,en;q=0.9" }, locale: "en-us" },
        {
          headers: {
            cookie: "NEXT_LOCALE=zh-cn; better-auth.session_token=private",
            "accept-language": "en-US",
          },
          locale: "zh-cn",
        },
        {
          headers: {
            cookie: "NEXT_LOCALE=en-us; better-auth.session_token=other",
            "accept-language": "zh-CN",
          },
          locale: "en-us",
        },
      ];
      for (const scenario of scenarios) {
        const headers = new Headers(scenario.headers);
        headers.set("accept", "text/html");
        const response = await withHtmlRewriter(() =>
          worker.fetch(
            new Request(`https://life-ustc.test${path}`, { headers }),
            {},
            context,
          ),
        );
        expect(response.status).toBe(200);
        const dispatched = dispatches.at(-1);
        expect(dispatched?.locale).toBe(scenario.locale);
        expect(dispatched?.key).toBe(
          `${path}?__life_locale=${scenario.locale}&__life_mode=page`,
        );
        const prior = keys.get(scenario.locale);
        if (prior) expect(dispatched?.key).toBe(prior);
        keys.set(scenario.locale, dispatched?.key ?? "");
      }
      expect(keys.size).toBe(2);
      expect(new Set(keys.values()).size).toBe(2);
    }
    expect(appFetchMock).not.toHaveBeenCalled();
    expect(publicSsrFetch).toHaveBeenCalledTimes(12);
  });

  it("records exactly one completion for a public SSR response", async () => {
    const publicSsrFetchMock = vi.fn().mockResolvedValue(
      new Response("public", {
        headers: {
          "cf-cache-status": "HIT",
          "content-type": "text/html; charset=utf-8",
          "X-Robots-Tag": "noindex, nofollow, noarchive",
        },
      }),
    );

    const response = await withHtmlRewriter(() =>
      worker.fetch(
        new Request("https://life-ustc.test/account/sign-in", {
          headers: { accept: "text/html" },
        }),
        {},
        {
          exports: {
            PublicSsr: publicSsrExportStub(() => ({
              fetch: publicSsrFetchMock,
            })),
          },
          waitUntil: vi.fn(),
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Robots-Tag")).toBe(
      "noindex, nofollow, noarchive",
    );
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/i);
    expect(publicSsrFetchMock).toHaveBeenCalledTimes(1);
    const [cachedRequest, cacheOptions] =
      publicSsrFetchMock.mock.calls[0] ?? [];
    expect(cachedRequest).toBeInstanceOf(Request);
    expect(cachedRequest.url).toBe(
      "https://life-ustc.test/account/sign-in?__life_locale=zh-cn&__life_mode=page",
    );
    expect(cachedRequest.headers.get("cookie")).toBeNull();
    expect(cachedRequest.headers.get("authorization")).toBeNull();
    expect(cachedRequest.headers.get(INTERNAL_REQUEST_ID_HEADER)).toBe(
      response.headers.get("x-request-id"),
    );
    expect(cacheOptions).toEqual({
      cf: {
        cacheKey: "/account/sign-in?__life_locale=zh-cn&__life_mode=page",
      },
    });
    expect(appFetchMock).not.toHaveBeenCalled();
    expect(logAppEventMock).toHaveBeenCalledTimes(1);
    expect(logAppEventMock).toHaveBeenCalledWith(
      "info",
      "edge.request.finish",
      expect.objectContaining({
        cacheOutcome: "hit",
        method: "GET",
        requestClass: "public-ssr-cache",
        requestId: response.headers.get("x-request-id"),
        status: 200,
      }),
    );
  });

  it("attributes dynamic API requests to a finite route family", async () => {
    const response = await worker.fetch(
      new Request(
        "https://life-ustc.test/api/catalog/courses/123?token=private-value",
      ),
      {},
      { waitUntil: vi.fn() },
    );

    expect(response.status).toBe(200);
    const completion = logAppEventMock.mock.calls.find(
      ([, event]) => event === "edge.request.finish",
    );
    expect(completion?.[2]).toEqual(
      expect.objectContaining({
        cacheOutcome: "dynamic",
        requestClass: "dynamic",
        route: "/api/catalog",
        status: 200,
      }),
    );
    expect(JSON.stringify(completion)).not.toContain("private-value");
  });

  it("rendering-and-cache.cache-layers-and-invalidation-1", async () => {
    const publicSsrFetchMock = vi.fn().mockImplementation(
      () =>
        new Response(null, {
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
    );
    const context = {
      exports: {
        PublicSsr: publicSsrExportStub(() => ({ fetch: publicSsrFetchMock })),
      },
      waitUntil: vi.fn(),
    };
    for (const cookie of [
      "NEXT_LOCALE=zh-cn",
      "NEXT_LOCALE=zh-cn; __Secure-better-auth.session_token=private-session",
    ]) {
      const response = await withHtmlRewriter(() =>
        worker.fetch(
          new Request("https://life-ustc.test/catalog/courses", {
            headers: { accept: "text/html", cookie },
          }),
          {},
          context,
        ),
      );
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
        "no-store",
      );
    }
    const requests = publicSsrFetchMock.mock.calls.map(
      ([request]) => request as Request,
    );
    expect(requests).toHaveLength(2);
    expect(requests[0].url).toBe(requests[1].url);
    for (const request of requests) {
      expect(request.headers.get("cookie")).toBeNull();
      expect(request.headers.get("authorization")).toBeNull();
      expect(request.headers.get("x-life-public-ssr")).toBe("1");
    }
    expect(appFetchMock).not.toHaveBeenCalled();
  });

  it("does not cache a calendar page whose render crossed Shanghai midnight", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-09-26T15:59:59Z"));
      appFetchMock.mockImplementation(async () => {
        vi.setSystemTime(new Date("2026-09-26T16:00:01Z"));
        return new Response("yesterday's calendar seed", {
          headers: { "content-type": "text/html" },
        });
      });
      const response = await new PublicSsr().fetch(
        new Request("https://life-ustc.test/catalog/sections/159446"),
      );
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
        "no-store",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not store per-request ids in the shared cache representation", async () => {
    appFetchMock.mockResolvedValue(
      new Response(null, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          [INTERNAL_REQUEST_ID_HEADER]: "stale-internal-id",
          "x-request-id": "stale-public-id",
        },
      }),
    );

    const cached = await new PublicSsr().fetch(
      new Request("https://life-ustc.test/account/sign-in"),
    );

    expect(cached.headers.get("x-request-id")).toBeNull();
    expect(cached.headers.get(INTERNAL_REQUEST_ID_HEADER)).toBeNull();
  });

  it("stamps each shared cache response with the current id and correlates one completion", async () => {
    const cachedResponse = new Response(null, {
      headers: {
        "cf-cache-status": "HIT",
        "content-type": "text/html; charset=utf-8",
        [INTERNAL_REQUEST_ID_HEADER]: "stale-internal-id",
        "x-request-id": "stale-public-id",
      },
    });
    const publicSsrFetchMock = vi.fn().mockResolvedValue(cachedResponse);
    const exports = {
      PublicSsr: publicSsrExportStub(() => ({ fetch: publicSsrFetchMock })),
    };
    const context = { exports, waitUntil: vi.fn() };

    const first = await withHtmlRewriter(() =>
      worker.fetch(
        new Request("https://life-ustc.test/account/sign-in", {
          headers: {
            accept: "text/html",
            [INTERNAL_REQUEST_ID_HEADER]: "spoofed-internal-id",
            "x-request-id": "spoofed-public-id",
          },
        }),
        {},
        context,
      ),
    );
    const second = await withHtmlRewriter(() =>
      worker.fetch(
        new Request("https://life-ustc.test/account/sign-in", {
          headers: {
            accept: "text/html",
            [INTERNAL_REQUEST_ID_HEADER]: "spoofed-internal-id-2",
            "x-request-id": "spoofed-public-id-2",
          },
        }),
        {},
        context,
      ),
    );

    const firstId = first.headers.get("x-request-id");
    const secondId = second.headers.get("x-request-id");
    expect(firstId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(secondId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(secondId).not.toBe(firstId);
    expect(first.headers.get(INTERNAL_REQUEST_ID_HEADER)).toBeNull();
    expect(second.headers.get(INTERNAL_REQUEST_ID_HEADER)).toBeNull();
    expect(firstId).not.toMatch(/stale|spoofed/);
    expect(secondId).not.toMatch(/stale|spoofed/);

    const completions = logAppEventMock.mock.calls.filter(
      ([, event]) => event === "edge.request.finish",
    );
    expect(completions).toHaveLength(2);
    expect(completions.map(([, , fields]) => fields.requestId)).toEqual([
      firstId,
      secondId,
    ]);
    expect(publicSsrFetchMock).toHaveBeenCalledTimes(2);
  });

  it("records one error completion before retaining the detailed worker error", async () => {
    const error = new Error("upstream app failure");
    appFetchMock.mockRejectedValueOnce(error);

    await expect(
      worker.fetch(
        new Request(
          "https://life-ustc.test/account/sign-in?state=oauth-state-secret",
          {
            body: "provider=google",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            method: "POST",
          },
        ),
        {},
        { waitUntil: vi.fn() },
      ),
    ).rejects.toBe(error);

    const edgeEvents = logAppEventMock.mock.calls.filter(
      ([, event]) => event === "edge.request.finish",
    );
    const workerErrorEvents = logAppEventMock.mock.calls.filter(
      ([, event]) => event === "worker.fetch.error",
    );
    expect(edgeEvents).toHaveLength(1);
    expect(workerErrorEvents).toHaveLength(1);
    const requestId = edgeEvents[0]?.[2]?.requestId;
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(edgeEvents[0]?.[2]).toEqual(
      expect.objectContaining({
        cacheOutcome: "dynamic",
        method: "POST",
        requestClass: "dynamic",
        requestId,
        route: normalizePublicSsrObservedRoute("/account/sign-in"),
        status: 500,
      }),
    );
    expect(workerErrorEvents[0]?.[2]).toEqual(
      expect.objectContaining({ requestId }),
    );
    expect(workerErrorEvents[0]?.[3]).toBe(error);
    expect(JSON.stringify(edgeEvents)).not.toContain("oauth-state-secret");
    expect(JSON.stringify(workerErrorEvents)).not.toContain(
      "oauth-state-secret",
    );
  });

  it("records exactly one completion for a catalog redirect", async () => {
    const response = await worker.fetch(
      new Request("https://life-ustc.test/sections/159446"),
      {},
      { waitUntil: vi.fn() },
    );

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("/catalog/sections/159446");
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/i);
    expect(appFetchMock).not.toHaveBeenCalled();
    expect(logAppEventMock).toHaveBeenCalledTimes(1);
    expect(logAppEventMock).toHaveBeenCalledWith(
      "info",
      "edge.request.finish",
      expect.objectContaining({
        cacheOutcome: "bypass",
        method: "GET",
        requestClass: "catalog-redirect",
        requestId: response.headers.get("x-request-id"),
        route: "/:legacy-catalog-route",
        status: 301,
      }),
    );
  });

  it("redirects the legacy sign-in path preserving the query string", async () => {
    const response = await worker.fetch(
      new Request(
        "https://life-ustc.test/signin?callbackUrl=%2Fworkspace%2Foverview",
      ),
      {},
      { waitUntil: vi.fn() },
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "/account/sign-in?callbackUrl=%2Fworkspace%2Foverview",
    );
    expect(response.headers.get("cache-control")).toBe("public, max-age=86400");
    expect(appFetchMock).not.toHaveBeenCalled();
    expect(logAppEventMock).toHaveBeenCalledWith(
      "info",
      "edge.request.finish",
      expect.objectContaining({
        requestClass: "legacy-redirect",
        route: "/signin",
        status: 308,
      }),
    );
  });

  it("redirects legacy user calendar feeds preserving the credential", async () => {
    const response = await worker.fetch(
      new Request(
        "https://life-ustc.test/api/users/user-1:feed-token/calendar.ics",
      ),
      {},
      { waitUntil: vi.fn() },
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "/api/calendar-feeds/user-1:feed-token.ics",
    );
    expect(appFetchMock).not.toHaveBeenCalled();
    expect(logAppEventMock).toHaveBeenCalledWith(
      "info",
      "edge.request.finish",
      expect.objectContaining({
        requestClass: "legacy-redirect",
        route: "/api/users/:credential/calendar.ics",
        status: 308,
      }),
    );
  });

  it("retires legacy calendar-subscription feeds with a gone response", async () => {
    const response = await worker.fetch(
      new Request(
        "https://life-ustc.test/api/calendar-subscriptions/sub-1/calendar.ics",
      ),
      {},
      { waitUntil: vi.fn() },
    );

    expect(response.status).toBe(410);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      error: expect.stringContaining("retired"),
    });
    expect(appFetchMock).not.toHaveBeenCalled();
    expect(logAppEventMock).toHaveBeenCalledWith(
      "info",
      "edge.request.finish",
      expect.objectContaining({
        requestClass: "legacy-redirect",
        route: "/api/calendar-subscriptions/:id/calendar.ics",
        status: 410,
      }),
    );
  });

  it("hops the internal cache purge into the PublicSsr entrypoint", async () => {
    const purgeCatalogRepresentations = vi
      .fn()
      .mockResolvedValue({ ok: true, tags: ["catalog"] });
    const publicSsrStub = publicSsrExportStub(() => ({
      fetch: vi.fn(),
      purgeCatalogRepresentations,
    }));

    const response = await worker.fetch(
      new Request(`https://life-ustc.test${PUBLIC_SSR_CACHE_PURGE_PATH}`, {
        headers: { [PUBLIC_SSR_CACHE_PURGE_SECRET_HEADER]: PURGE_SECRET },
        method: "POST",
      }),
      { [PUBLIC_SSR_CACHE_PURGE_SECRET_ENV]: PURGE_SECRET },
      { exports: { PublicSsr: publicSsrStub }, waitUntil: vi.fn() },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ purged: ["catalog"] });
    // The zone purge cannot reach this cache, so the request must end up on
    // the entrypoint that owns it rather than in the SvelteKit app.
    expect(purgeCatalogRepresentations).toHaveBeenCalledTimes(1);
    expect(appFetchMock).not.toHaveBeenCalled();
  });

  it("constructs the PublicSsr purge binding with an Options argument", async () => {
    const purgeCatalogRepresentations = vi
      .fn()
      .mockResolvedValue({ ok: true, tags: ["catalog"] });
    const publicSsrStub = publicSsrExportStub(() => ({
      fetch: vi.fn(),
      purgeCatalogRepresentations,
    }));

    const response = await worker.fetch(
      new Request(`https://life-ustc.test${PUBLIC_SSR_CACHE_PURGE_PATH}`, {
        headers: { [PUBLIC_SSR_CACHE_PURGE_SECRET_HEADER]: PURGE_SECRET },
        method: "POST",
      }),
      { [PUBLIC_SSR_CACHE_PURGE_SECRET_ENV]: PURGE_SECRET },
      { exports: { PublicSsr: publicSsrStub }, waitUntil: vi.fn() },
    );

    // The bare `PublicSsr()` this replaces threw before the RPC was ever
    // dispatched, so the endpoint answered 502 and the entrypoint cache was
    // never cleared. Pin the argument itself — asserting only that the purge
    // method ran is what let the bare call ship.
    expect(publicSsrStub).toHaveBeenCalledTimes(1);
    expect(publicSsrStub.mock.calls[0]).toHaveLength(1);
    expect(publicSsrStub.mock.calls[0]?.[0]).toBeTypeOf("object");
    expect(response.status).toBe(200);
    expect(purgeCatalogRepresentations).toHaveBeenCalledTimes(1);
  });

  it("rejects an unauthenticated cache purge without reaching the entrypoint", async () => {
    const purgeCatalogRepresentations = vi.fn();
    const publicSsrStub = publicSsrExportStub(() => ({
      fetch: vi.fn(),
      purgeCatalogRepresentations,
    }));

    const response = await worker.fetch(
      new Request(`https://life-ustc.test${PUBLIC_SSR_CACHE_PURGE_PATH}`, {
        method: "POST",
      }),
      { [PUBLIC_SSR_CACHE_PURGE_SECRET_ENV]: PURGE_SECRET },
      { exports: { PublicSsr: publicSsrStub }, waitUntil: vi.fn() },
    );

    expect(response.status).toBe(401);
    expect(purgeCatalogRepresentations).not.toHaveBeenCalled();
    expect(appFetchMock).not.toHaveBeenCalled();
  });

  it.each(["development", "test"])(
    "has nothing to purge when local %s workerd has no Workers Cache",
    async (NODE_ENV) => {
      const entrypoint = new PublicSsr();
      Object.defineProperty(entrypoint, "env", { value: { NODE_ENV } });
      Object.defineProperty(entrypoint, "ctx", { value: {} });
      await expect(entrypoint.purgeCatalogRepresentations()).resolves.toEqual({
        ok: true,
        tags: [],
      });
    },
  );

  it.each(["production", undefined])(
    "rejects an unavailable Workers Cache outside local profiles (NODE_ENV=%s)",
    async (NODE_ENV) => {
      const entrypoint = new PublicSsr();
      Object.defineProperty(entrypoint, "env", { value: { NODE_ENV } });
      Object.defineProperty(entrypoint, "ctx", { value: {} });
      await expect(entrypoint.purgeCatalogRepresentations()).resolves.toEqual({
        ok: false,
        reason: "cache-unavailable",
      });
    },
  );

  it("still purges a cache available in the local test profile", async () => {
    const entrypoint = new PublicSsr();
    const purge = vi.fn().mockResolvedValue({ success: true });
    Object.defineProperty(entrypoint, "env", { value: { NODE_ENV: "test" } });
    Object.defineProperty(entrypoint, "ctx", { value: { cache: { purge } } });
    await expect(
      entrypoint.purgeCatalogRepresentations(),
    ).resolves.toMatchObject({ ok: true, tags: ["catalog"] });
    expect(purge).toHaveBeenCalledOnce();
  });

  it("purges only the catalog tag from the PublicSsr entrypoint cache", async () => {
    const purge = vi.fn().mockResolvedValue({ success: true });
    const entrypoint = new PublicSsr();
    // `cache.purge()` is scoped to the calling entrypoint, so this method has
    // to run here rather than in the default entrypoint or the Node loader.
    Object.defineProperty(entrypoint, "ctx", { value: { cache: { purge } } });

    await expect(entrypoint.purgeCatalogRepresentations()).resolves.toEqual({
      ok: true,
      tags: ["catalog"],
    });
    expect(purge).toHaveBeenCalledWith({ tags: ["catalog"] });
  });

  it("logs and acks each calendar dead-letter message without retrying", async () => {
    const messages = [
      {
        ack: vi.fn(),
        attempts: 4,
        body: { type: "user", userId: "user-secret" },
        id: "message-1",
        retry: vi.fn(),
      },
      {
        ack: vi.fn(),
        attempts: 4,
        body: { type: "section", sectionId: 159446 },
        id: "message-2",
        retry: vi.fn(),
      },
    ];

    await worker.queue(
      {
        messages,
        queue: "life-ustc-calendar-export-rebuild-dlq",
      },
      {},
      { waitUntil: vi.fn() },
    );

    expect(handleCalendarExportRebuildBatchMock).not.toHaveBeenCalled();
    for (const message of messages) {
      expect(message.ack).toHaveBeenCalledTimes(1);
      expect(message.retry).not.toHaveBeenCalled();
    }
    const deadLetters = logAppEventMock.mock.calls.filter(
      ([, event]) => event === "worker.queue.dead-letter",
    );
    expect(deadLetters).toHaveLength(2);
    expect(deadLetters[0]).toEqual([
      "error",
      "worker.queue.dead-letter",
      expect.objectContaining({
        messageId: "message-1",
        messageType: "user",
        outcome: "dead-letter",
        queue: "calendar-dead-letter",
      }),
    ]);
    expect(JSON.stringify(deadLetters)).not.toContain("user-secret");
  });

  it("logs and acks each audit dead-letter message without retrying", async () => {
    const message = {
      ack: vi.fn(),
      attempts: 6,
      body: {
        auditId: "audit-1",
        params: { action: "sign-in", sessionId: "session-secret" },
        type: "audit-log.write.v1",
      },
      id: "message-9",
      retry: vi.fn(),
    };

    await worker.queue(
      {
        messages: [message],
        queue: "life-ustc-audit-log-write-dlq",
      },
      {},
      { waitUntil: vi.fn() },
    );

    expect(handleAuditLogWriteBatchMock).not.toHaveBeenCalled();
    expect(message.ack).toHaveBeenCalledTimes(1);
    expect(message.retry).not.toHaveBeenCalled();
    const deadLetters = logAppEventMock.mock.calls.filter(
      ([, event]) => event === "worker.queue.dead-letter",
    );
    expect(deadLetters).toHaveLength(1);
    expect(deadLetters[0]?.[2]).toEqual(
      expect.objectContaining({
        messageId: "message-9",
        messageType: "audit-log.write.v1",
        queue: "audit-dead-letter",
      }),
    );
    expect(JSON.stringify(logAppEventMock.mock.calls)).not.toContain(
      "session-secret",
    );
  });

  it("records one queue completion with the audit handler outcome", async () => {
    handleAuditLogWriteBatchMock.mockResolvedValue({ outcome: "retry" });

    await worker.queue(
      {
        messages: [{}],
        queue: "life-ustc-audit-log-write",
      },
      {},
      { waitUntil: vi.fn() },
    );

    const queueFinishes = logAppEventMock.mock.calls.filter(
      ([, event]) => event === "worker.queue.finish",
    );
    expect(handleAuditLogWriteBatchMock).toHaveBeenCalledOnce();
    expect(queueFinishes).toHaveLength(1);
    expect(queueFinishes[0]).toEqual([
      "warn",
      "worker.queue.finish",
      expect.objectContaining({
        messageCount: 1,
        outcome: "retry",
        queue: "audit",
      }),
    ]);
  });

  it("records one calendar queue completion with a retry outcome", async () => {
    handleCalendarExportRebuildBatchMock.mockResolvedValue({
      outcome: "retry",
    });

    await worker.queue(
      {
        messages: [{}],
        queue: "life-ustc-calendar-export-rebuild",
      },
      {},
      { waitUntil: vi.fn() },
    );

    const queueFinishes = logAppEventMock.mock.calls.filter(
      ([, event]) => event === "worker.queue.finish",
    );
    expect(handleCalendarExportRebuildBatchMock).toHaveBeenCalledOnce();
    expect(queueFinishes).toHaveLength(1);
    expect(queueFinishes[0]).toEqual([
      "warn",
      "worker.queue.finish",
      expect.objectContaining({
        messageCount: 1,
        outcome: "retry",
        queue: "calendar",
      }),
    ]);
  });
});

it("audit.retention-maintenance-cadence", async () => {
  const config = parse(
    readFileSync(
      new URL("../../../../wrangler.jsonc", import.meta.url),
      "utf8",
    ),
  );
  expect(config.triggers.crons).toContain("23 */6 * * *");
  const controller = { cron: "23 */6 * * *" };
  const context = { waitUntil: vi.fn() };
  cleanupExpiredAuthRecordsMock.mockResolvedValue({
    sessions: 0,
    verificationTokens: 0,
    oauthAccessTokens: 0,
    oauthRefreshTokens: 0,
    deviceCodes: 0,
  });
  const report = {
    auditRetentionBatches: 1,
    auditRetentionComplete: true,
    attributionAnonymized: 2,
    networkAnonymized: 3,
    rowsDeleted: 4,
  };
  maintainAuditLogRetentionMock.mockResolvedValue(report);
  logAppEventMock.mockClear();
  await worker.scheduled(controller, {}, context);
  expect(maintainAuditLogRetentionMock).toHaveBeenCalledTimes(1);
  expect(logAppEventMock.mock.calls).toContainEqual([
    "info",
    "scheduled.task.finish",
    expect.objectContaining({
      ...report,
      task: "auth-and-audit-retention",
      outcome: "success",
    }),
  ]);
  for (const mode of ["incomplete", "failed"]) {
    logAppEventMock.mockClear();
    if (mode === "incomplete")
      maintainAuditLogRetentionMock.mockResolvedValue({
        ...report,
        auditRetentionBatches: 20,
        auditRetentionComplete: false,
      });
    else
      maintainAuditLogRetentionMock.mockRejectedValue(
        new Error("private database failure"),
      );
    await expect(worker.scheduled(controller, {}, context)).rejects.toThrow(
      mode === "incomplete"
        ? "Audit retention did not finish"
        : "private database failure",
    );
    expect(
      logAppEventMock.mock.calls.filter(
        (call) => call[1] === "scheduled.task.finish",
      ),
    ).toEqual([]);
    expect(logAppEventMock.mock.calls).toContainEqual([
      "error",
      "scheduled.task.error",
      expect.objectContaining({
        task: "auth-and-audit-retention",
        outcome: "error",
      }),
      expect.any(Error),
    ]);
  }
});

it("weather.weather-refresh-budget", async () => {
  const { writeWeatherCache, readWeatherCache } = await import(
    "@/features/weather/server/weather-cache"
  );
  const { writeWeatherHistory } = await import(
    "@/features/weather/server/weather-history"
  );
  const config = parse(readFileSync("wrangler.jsonc", "utf8"));
  const calls: URL[] = [];
  vi.stubEnv("AMAP_API_KEY", "test-provider-key");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      calls.push(url);
      return Response.json(
        url.hostname === "restapi.amap.com"
          ? { lives: [{ temperature: "22", weather: "晴" }], forecasts: [] }
          : { current: { temperature_2m: 21, weather_code: 0 } },
      );
    }),
  );
  vi.mocked(writeWeatherCache).mockClear();
  vi.mocked(writeWeatherHistory).mockClear();
  vi.mocked(readWeatherCache).mockClear();
  const ticks: Record<string, number> = { "ustc-main": 0, "ustc-gaoxin": 0 };
  try {
    for (const [cron, interval, key, adcode] of [
      ["*/20 * * * *", 20, "ustc-main", "340100"],
      ["*/30 * * * *", 30, "ustc-gaoxin", "340104"],
    ] as const) {
      expect(config.triggers.crons).toContain(cron);
      for (let minute = 0; minute < 1440; minute += interval) {
        const start = calls.length;
        await worker.scheduled({ cron }, {}, { waitUntil: vi.fn() });
        ticks[key]++;
        const tick = calls.slice(start);
        expect(tick).toHaveLength(3);
        expect(
          tick
            .filter((url) => url.hostname === "restapi.amap.com")
            .map((url) => [
              url.searchParams.get("city"),
              url.searchParams.get("extensions"),
            ]),
        ).toEqual([
          [adcode, "base"],
          [adcode, "all"],
        ]);
        expect(
          tick.filter((url) => url.hostname === "api.open-meteo.com"),
        ).toHaveLength(1);
        expect(vi.mocked(writeWeatherCache).mock.calls.at(-1)?.[0]).toBe(key);
      }
    }
    expect(ticks).toEqual({ "ustc-main": 72, "ustc-gaoxin": 48 });
    expect(
      calls.filter((url) => url.hostname === "restapi.amap.com"),
    ).toHaveLength(240);
    expect(
      calls.filter((url) => url.hostname === "api.open-meteo.com"),
    ).toHaveLength(120);
    expect(writeWeatherHistory).toHaveBeenCalledTimes(120);
    expect(readWeatherCache).not.toHaveBeenCalled();
    vi.mocked(fetch).mockImplementation(async (input) => {
      calls.push(new URL(String(input)));
      return new Response(null, { status: 503 });
    });
    const start = calls.length;
    await worker.scheduled(
      { cron: "*/20 * * * *" },
      {},
      { waitUntil: vi.fn() },
    );
    expect(calls.length - start).toBe(3);
    expect(writeWeatherCache).toHaveBeenCalledTimes(120);
    expect(writeWeatherHistory).toHaveBeenCalledTimes(120);
  } finally {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  }
});
