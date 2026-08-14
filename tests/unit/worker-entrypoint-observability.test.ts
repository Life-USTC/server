import { afterEach, describe, expect, it, vi } from "vitest";

const { logAppEventMock } = vi.hoisted(() => ({
  logAppEventMock: vi.fn(),
}));

vi.mock("@/lib/log/app-logger", () => ({
  logAppEvent: logAppEventMock,
}));

import {
  logScheduledTaskFinish,
  logUnknownScheduledTask,
  normalizePublicSsrObservedRoute,
  observedEdgeResponse,
  resolveEdgeCacheOutcome,
} from "@/lib/log/worker-entrypoint-observability";

describe("worker entrypoint observability", () => {
  afterEach(() => {
    vi.clearAllMocks();
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
    expect(normalizePublicSsrObservedRoute("/users/user-secret")).toBe(
      "public-page",
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
    vi.setSystemTime(new Date("2026-08-14T10:00:00.250Z"));
    const response = observedEdgeResponse({
      cacheOutcome: "hit",
      request: new Request(
        "https://life-ustc.tiankaima.dev/catalog/courses/course-secret?token=secret",
      ),
      requestClass: "public-ssr-cache",
      requestId: "request-1",
      response: new Response("ok", { status: 200 }),
      route: "/catalog/courses/:id",
      startMs: new Date("2026-08-14T10:00:00.000Z").getTime(),
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
        source: "worker-entrypoint",
      },
    );
  });
});
