import { afterEach, describe, expect, it, vi } from "vitest";

const { logAppEventMock, writeWorkerRequestAnalyticsMock } = vi.hoisted(() => ({
  logAppEventMock: vi.fn(),
  writeWorkerRequestAnalyticsMock: vi.fn(),
}));

vi.mock("@/lib/log/app-logger", () => ({
  logAppEvent: logAppEventMock,
}));
vi.mock("@/lib/metrics/analytics-engine", () => ({
  writeWorkerRequestAnalytics: writeWorkerRequestAnalyticsMock,
}));

import {
  getTrustedRequestId,
  INTERNAL_REQUEST_ID_HEADER,
  logScheduledTaskError,
  logScheduledTaskFinish,
  logUnknownScheduledTask,
  logWorkerFetchError,
  logWorkerQueueError,
  logWorkerQueueFinish,
  normalizePublicSsrObservedRoute,
  normalizeWorkerObservedRoute,
  observedEdgeResponse,
  resolveEdgeCacheOutcome,
  resolveWorkerQueue,
  setTrustedRequestIdHeader,
} from "@/lib/log/worker-entrypoint-observability";

describe("worker entrypoint observability", () => {
  afterEach(() => {
    vi.clearAllMocks();
    writeWorkerRequestAnalyticsMock.mockReset();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("normalizes public SSR routes without retaining entity identifiers", () => {
    expect(
      normalizePublicSsrObservedRoute("/catalog/courses/course-secret"),
    ).toBe("/catalog/courses/:id");
    expect(normalizePublicSsrObservedRoute("/catalog/sections/12345")).toBe(
      "/catalog/sections/:id",
    );
    expect(normalizePublicSsrObservedRoute("/api/docs/rest/catalog")).toBe(
      "/api/docs/:page",
    );
    expect(normalizePublicSsrObservedRoute("/privacy")).toBe("/privacy");
    expect(normalizePublicSsrObservedRoute("/account/sign-in")).toBe(
      "/account/sign-in",
    );
    expect(normalizePublicSsrObservedRoute("/users/user-secret")).toBe(
      "public-page",
    );
  });

  it("normalizes dynamic API routes to finite families without queries or IDs", () => {
    expect(
      normalizeWorkerObservedRoute(
        "/api/catalog/courses/123?token=private-value",
      ),
    ).toBe("/api/catalog");
    expect(normalizeWorkerObservedRoute("/api/mcp/tools/call")).toBe(
      "/api/mcp",
    );
    expect(
      normalizeWorkerObservedRoute("/api/not-allowlisted/user-secret"),
    ).toBe("/api/other");
    expect(normalizeWorkerObservedRoute("/api")).toBe("/api/other");
    expect(normalizeWorkerObservedRoute("/catalog/courses/course-secret")).toBe(
      "/catalog/courses/:id",
    );
  });

  it("only emits allowlisted cache outcomes", () => {
    expect(
      resolveEdgeCacheOutcome(
        new Response(null, { headers: { "CF-Cache-Status": "HIT" } }),
      ),
    ).toBe("hit");
    expect(
      resolveEdgeCacheOutcome(
        new Response(null, {
          headers: { "CF-Cache-Status": "tenant-secret" },
        }),
      ),
    ).toBe("unknown");
  });

  it("adds the request id and logs a safe finish record", () => {
    vi.useFakeTimers();
    const startMs = performance.now();
    vi.advanceTimersByTime(250);
    const response = observedEdgeResponse({
      cacheOutcome: "hit",
      request: new Request(
        "https://life-ustc.tiankaima.dev/catalog/courses/course-secret?token=secret",
      ),
      requestClass: "public-ssr-cache",
      requestId: "request-1",
      response: new Response("ok", { status: 200 }),
      route: "/catalog/courses/:id",
      startMs,
    });

    expect(response.headers.get("x-request-id")).toBe("request-1");
    expect(logAppEventMock).toHaveBeenCalledWith(
      "info",
      "edge.request.finish",
      {
        cacheOutcome: "hit",
        event: "edge.request.finish",
        ioObservedDurationMs: 250,
        method: "GET",
        requestClass: "public-ssr-cache",
        requestId: "request-1",
        route: "/catalog/courses/:id",
        source: "worker-entrypoint",
        status: 200,
      },
    );
    expect(JSON.stringify(logAppEventMock.mock.calls)).not.toContain(
      "course-secret",
    );
    expect(JSON.stringify(logAppEventMock.mock.calls)).not.toContain("token");
  });

  it("keeps the original body response when edge telemetry fails", async () => {
    const cancelMock = vi.fn();
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("unauthorized"));
          controller.close();
        },
        cancel: cancelMock,
      }),
      { status: 401 },
    );
    writeWorkerRequestAnalyticsMock.mockImplementation(() => {
      throw new Error("analytics sink unavailable");
    });
    logAppEventMock.mockImplementation((_: unknown, message: string) => {
      if (message === "edge.request.finish") {
        throw new Error("log sink unavailable");
      }
    });

    const observed = observedEdgeResponse({
      cacheOutcome: "dynamic",
      request: new Request("https://example.test/api/workspace/subscriptions", {
        method: "PATCH",
      }),
      requestClass: "dynamic",
      requestId: "request-1",
      response,
      route: "public-page",
      startMs: performance.now(),
    });

    expect(observed).toBe(response);
    await expect(observed.text()).resolves.toBe("unauthorized");
    expect(cancelMock).not.toHaveBeenCalled();
    expect(logAppEventMock).toHaveBeenCalledWith(
      "error",
      "edge.request.observation.error",
      expect.objectContaining({
        errorName: "Error",
        failurePhase: "analytics",
      }),
    );
  });

  it("wraps immutable redirects without changing response semantics", () => {
    const response = Response.redirect("https://example.test/login", 302);
    vi.spyOn(response.headers, "set").mockImplementation(() => {
      throw new TypeError("Can't modify immutable headers.");
    });

    const observed = observedEdgeResponse({
      cacheOutcome: "bypass",
      request: new Request("https://example.test/account/sign-in"),
      requestClass: "catalog-redirect",
      requestId: "request-1",
      response,
      route: "/account/sign-in",
      startMs: performance.now(),
    });

    expect(observed).not.toBe(response);
    expect(observed.status).toBe(302);
    expect(observed.statusText).toBe(response.statusText);
    expect(observed.headers.get("location")).toBe("https://example.test/login");
    expect(observed.headers.get("x-request-id")).toBe("request-1");
    expect(
      logAppEventMock.mock.calls.some(
        ([, event, fields]) =>
          event === "edge.request.observation.error" &&
          (fields as { failurePhase?: string })?.failurePhase === "request-id",
      ),
    ).toBe(false);
  });

  it("transfers streaming bodies and preserves multiple Set-Cookie headers", async () => {
    const cancelMock = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("streamed"));
        controller.close();
      },
      cancel: cancelMock,
    });
    const headers = new Headers();
    headers.append("Set-Cookie", "session=one");
    headers.append("Set-Cookie", "theme=dark");
    headers.set("x-request-id", "stale-response-id");
    const response = new Response(stream, {
      headers,
      status: 206,
      statusText: "Partial Content",
    });
    vi.spyOn(response.headers, "set").mockImplementation(() => {
      throw new TypeError("Can't modify immutable headers.");
    });

    const observed = observedEdgeResponse({
      cacheOutcome: "dynamic",
      request: new Request("https://example.test/stream", {
        headers: {
          [INTERNAL_REQUEST_ID_HEADER]: "spoofed-inbound-id",
          "x-request-id": "spoofed-public-id",
        },
      }),
      requestClass: "dynamic",
      requestId: "request-1",
      response,
      route: "public-page",
      startMs: performance.now(),
    });

    expect(observed).not.toBe(response);
    expect(observed.body).toBe(response.body);
    expect(observed.status).toBe(206);
    expect(observed.statusText).toBe("Partial Content");
    expect(observed.headers.get("x-request-id")).toBe("request-1");
    expect(JSON.stringify(logAppEventMock.mock.calls)).not.toContain(
      "spoofed-inbound-id",
    );
    expect(JSON.stringify(logAppEventMock.mock.calls)).not.toContain(
      "spoofed-public-id",
    );
    const observedHeaders = observed.headers as Headers & {
      getAll?: (name: string) => string[];
      getSetCookie?: () => string[];
    };
    expect(
      observedHeaders.getSetCookie?.() ??
        observedHeaders.getAll?.("set-cookie"),
    ).toEqual(["session=one", "theme=dark"]);
    await expect(observed.text()).resolves.toBe("streamed");
    expect(cancelMock).not.toHaveBeenCalled();
  });

  it("reports a real request-id fallback failure and returns the original response", () => {
    const response = new Response("locked");
    vi.spyOn(response.headers, "set").mockImplementation(() => {
      throw new TypeError("Can't modify immutable headers.");
    });
    const reader = response.body?.getReader();

    const observed = observedEdgeResponse({
      cacheOutcome: "dynamic",
      request: new Request("https://example.test/locked"),
      requestClass: "dynamic",
      requestId: "request-1",
      response,
      route: "public-page",
      startMs: performance.now(),
    });
    reader?.releaseLock();

    expect(observed).toBe(response);
    expect(logAppEventMock).toHaveBeenCalledWith(
      "error",
      "edge.request.observation.error",
      expect.objectContaining({
        errorName: "TypeError",
        failurePhase: "request-id",
      }),
    );
  });

  it("does not hide non-immutability request-id injection failures", () => {
    const response = new Response("unavailable");
    vi.spyOn(response.headers, "set").mockImplementation(() => {
      throw new Error("header sink unavailable");
    });

    const observed = observedEdgeResponse({
      cacheOutcome: "dynamic",
      request: new Request("https://example.test/header-failure"),
      requestClass: "dynamic",
      requestId: "request-1",
      response,
      route: "public-page",
      startMs: performance.now(),
    });

    expect(observed).toBe(response);
    expect(logAppEventMock).toHaveBeenCalledWith(
      "error",
      "edge.request.observation.error",
      expect.objectContaining({
        errorName: "Error",
        failurePhase: "request-id",
      }),
    );
  });

  it("only accepts the internal UUID header and strips external request ids", () => {
    const request = new Request("https://example.test/api/health", {
      headers: {
        [INTERNAL_REQUEST_ID_HEADER]: "external-value",
        "x-request-id": "client-value",
      },
    });
    expect(getTrustedRequestId(request)).toBeUndefined();

    const headers = new Headers(request.headers);
    setTrustedRequestIdHeader(headers, "11111111-1111-4111-8111-111111111111");
    const trusted = new Request(request, { headers });
    expect(getTrustedRequestId(trusted)).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(trusted.headers.get("x-request-id")).toBeNull();
  });

  it("classifies only the two configured queues", () => {
    expect(resolveWorkerQueue("life-ustc-audit-log-write")).toBe("audit");
    expect(resolveWorkerQueue("life-ustc-calendar-export-rebuild")).toBe(
      "calendar",
    );
    expect(resolveWorkerQueue("unexpected-queue")).toBe("unknown");
  });

  it("records queue and scheduled outcomes", () => {
    logWorkerQueueFinish({
      ioObservedDurationMs: 34,
      messageCount: 2,
      queue: "audit",
    });
    logScheduledTaskFinish("upload-pending-cleanup", { completed: 2 }, 56);

    expect(logAppEventMock).toHaveBeenNthCalledWith(
      1,
      "info",
      "worker.queue.finish",
      expect.objectContaining({
        event: "worker.queue.finish",
        messageCount: 2,
        outcome: "success",
        queue: "audit",
      }),
    );
    expect(logAppEventMock).toHaveBeenNthCalledWith(
      2,
      "info",
      "scheduled.task.finish",
      expect.objectContaining({
        completed: 2,
        event: "scheduled.task.finish",
        ioObservedDurationMs: 56,
        outcome: "success",
      }),
    );
  });

  it("samples queue successes deterministically but retains slow completions", () => {
    vi.stubEnv("NODE_ENV", "production");

    logWorkerQueueFinish({
      ioObservedDurationMs: 34,
      messageCount: 2,
      queue: "audit",
      sampleKey: "queue-0",
    });
    expect(logAppEventMock).not.toHaveBeenCalled();

    logWorkerQueueFinish({
      ioObservedDurationMs: 34,
      messageCount: 2,
      queue: "audit",
      sampleKey: "queue-70",
    });
    expect(logAppEventMock).toHaveBeenCalledTimes(1);

    logWorkerQueueFinish({
      ioObservedDurationMs: 1_000,
      messageCount: 2,
      queue: "audit",
      sampleKey: "queue-0",
    });
    expect(logAppEventMock).toHaveBeenCalledTimes(2);
  });

  it("always retains retry and partial queue completions", () => {
    vi.stubEnv("NODE_ENV", "production");

    logWorkerQueueFinish({
      ioObservedDurationMs: 34,
      messageCount: 2,
      outcome: "retry",
      queue: "audit",
      sampleKey: "queue-0",
    });
    logWorkerQueueFinish({
      ioObservedDurationMs: 34,
      messageCount: 2,
      outcome: "partial",
      queue: "audit",
      sampleKey: "queue-0",
    });

    expect(logAppEventMock).toHaveBeenCalledTimes(2);
    expect(logAppEventMock).toHaveBeenNthCalledWith(
      1,
      "warn",
      "worker.queue.finish",
      expect.objectContaining({ outcome: "retry" }),
    );
    expect(logAppEventMock).toHaveBeenNthCalledWith(
      2,
      "warn",
      "worker.queue.finish",
      expect.objectContaining({ outcome: "partial" }),
    );
  });

  it("records failures without changing the original error", () => {
    const error = new Error("private detail");
    logWorkerFetchError({
      error,
      ioObservedDurationMs: 12,
      requestId: "request-1",
    });
    logWorkerQueueError({
      error,
      ioObservedDurationMs: 34,
      messageCount: 1,
      queue: "unknown",
    });
    logScheduledTaskError("unknown", 56, error);

    expect(logAppEventMock).toHaveBeenNthCalledWith(
      1,
      "error",
      "worker.fetch.error",
      expect.objectContaining({
        event: "worker.fetch.error",
        outcome: "error",
      }),
      error,
    );
    expect(logAppEventMock).toHaveBeenNthCalledWith(
      2,
      "error",
      "worker.queue.error",
      expect.objectContaining({
        event: "worker.queue.error",
        outcome: "error",
        queue: "unknown",
      }),
      error,
    );
    expect(logAppEventMock).toHaveBeenNthCalledWith(
      3,
      "error",
      "scheduled.task.error",
      expect.objectContaining({
        event: "scheduled.task.error",
        outcome: "error",
        task: "unknown",
      }),
      error,
    );
  });

  it("logs scheduled outcomes without exposing cron expressions", () => {
    logScheduledTaskFinish("upload-pending-cleanup", {
      completed: 2,
      failed: 0,
    });
    logUnknownScheduledTask();

    expect(logAppEventMock).toHaveBeenNthCalledWith(
      1,
      "info",
      "scheduled.task.finish",
      {
        completed: 2,
        event: "scheduled.task.finish",
        failed: 0,
        outcome: "success",
        source: "worker-entrypoint",
        task: "upload-pending-cleanup",
      },
    );
    expect(logAppEventMock).toHaveBeenNthCalledWith(
      2,
      "warn",
      "scheduled.task.unknown",
      {
        event: "scheduled.task.unknown",
        outcome: "unknown",
        source: "worker-entrypoint",
      },
    );
  });
});
