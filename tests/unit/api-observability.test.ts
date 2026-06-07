import { afterEach, describe, expect, it, vi } from "vitest";
import {
  normalizeApiRoutePath,
  observedApiRoute,
  recordApiRequestStart,
  shouldObserveApiPath,
} from "@/lib/log/api-observability";
import {
  renderPrometheusMetrics,
  resetRuntimeMetricsForTest,
} from "@/lib/metrics/runtime-metrics";

describe("api observability", () => {
  afterEach(() => {
    resetRuntimeMetricsForTest();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("normalizes high-cardinality route segments", () => {
    expect(normalizeApiRoutePath("/api/todos/123")).toBe("/api/todos/:id");
    expect(normalizeApiRoutePath("/api/calendar-subscriptions/current")).toBe(
      "/api/calendar-subscriptions/current",
    );
    expect(
      normalizeApiRoutePath(
        "/api/comments/018d7a46-1e0b-7c3d-9f6a-123456789abc",
      ),
    ).toBe("/api/comments/:id");
    expect(normalizeApiRoutePath("/api/uploads/clx1234567890abcdef")).toBe(
      "/api/uploads/:id",
    );
  });

  it("records safe request-start logs and metrics", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    recordApiRequestStart({
      method: "GET",
      pathname: "/api/todos/123",
      requestId: "request-1",
    });

    expect(info).toHaveBeenCalledWith(
      "[api]",
      expect.objectContaining({
        event: "request.start",
        method: "GET",
        path: "/api/todos/:id",
        requestId: "request-1",
        status: 0,
      }),
    );
    expect(renderPrometheusMetrics()).toContain(
      'life_ustc_api_requests_started_total{method="GET",route="/api/todos/:id"} 1',
    );
  });

  it("skips the metrics endpoint", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    expect(shouldObserveApiPath("/api/metrics")).toBe(false);
    recordApiRequestStart({
      method: "GET",
      pathname: "/api/metrics",
      requestId: "request-1",
    });

    expect(info).not.toHaveBeenCalled();
    expect(renderPrometheusMetrics()).not.toContain(
      "life_ustc_api_requests_started_total",
    );
  });

  it("records response status, duration, and auth mode", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:01.000Z"));
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const route = observedApiRoute(() => Response.json({ ok: true }));

    const response = await route(
      new Request("https://example.test/api/todos/123", {
        headers: {
          authorization: "Bearer token-value",
          "x-request-id": "request-1",
          "x-request-start-ms": "1780790400000",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(info).toHaveBeenCalledWith(
      "[api]",
      expect.objectContaining({
        authMode: "bearer",
        durationMs: 1000,
        event: "request.finish",
        method: "GET",
        path: "/api/todos/:id",
        requestId: "request-1",
        status: 200,
      }),
    );

    const metrics = renderPrometheusMetrics();
    expect(metrics).toContain(
      'life_ustc_api_requests_total{auth_mode="bearer",method="GET",route="/api/todos/:id",status="200"} 1',
    );
    expect(metrics).toContain(
      'life_ustc_api_request_duration_ms_sum{method="GET",route="/api/todos/:id"} 1000',
    );
  });

  it("records thrown route errors before rethrowing", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:01.000Z"));
    vi.spyOn(console, "info").mockImplementation(() => {});
    const route = observedApiRoute(() => {
      throw new Error("boom");
    });

    await expect(
      route(
        new Request("https://example.test/api/todos/123", {
          headers: {
            cookie: "better-auth.session_token=session-token",
            "x-request-id": "request-1",
            "x-request-start-ms": "1780790400000",
          },
        }),
      ),
    ).rejects.toThrow("boom");

    expect(renderPrometheusMetrics()).toContain(
      'life_ustc_api_errors_total{method="GET",route="/api/todos/:id",status="500"} 1',
    );
  });
});
