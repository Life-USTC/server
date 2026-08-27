import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  appFetchMock,
  handleAuditLogWriteBatchMock,
  handleCalendarExportRebuildBatchMock,
  logAppEventMock,
  runWithCloudflareRuntimeEnvMock,
  setCloudflareRequestContextMock,
} = vi.hoisted(() => ({
  appFetchMock: vi.fn(),
  handleAuditLogWriteBatchMock: vi.fn(),
  handleCalendarExportRebuildBatchMock: vi.fn(),
  logAppEventMock: vi.fn(),
  runWithCloudflareRuntimeEnvMock: vi.fn(
    (_env: unknown, callback: () => unknown) => callback(),
  ),
  setCloudflareRequestContextMock: vi.fn(),
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
  INTERNAL_REQUEST_ID_HEADER,
  normalizePublicSsrObservedRoute,
} from "@/lib/log/worker-entrypoint-observability";
import worker from "@/worker";

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

  it("correlates and sanitizes dynamic sign-in requests without changing method or body", async () => {
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
    await expect(forwardedRequest.text()).resolves.toBe("provider=google");
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
            PublicSsr: vi.fn(() => ({ fetch: publicSsrFetchMock })),
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
