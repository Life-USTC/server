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

describe("API 可观测性", () => {
  afterEach(() => {
    resetRuntimeMetricsForTest();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("规范化高基数路由段", () => {
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

  it("隐去日历订阅路径令牌", () => {
    const normalized = normalizeApiRoutePath(
      "/api/users/user-1:feed-token-0123456789/calendar.ics",
    );
    const encodedSeparator = normalizeApiRoutePath(
      "/api/users/user-1%3Afeed-token-0123456789/calendar.ics",
    );

    expect(normalized).toBe("/api/users/:id/calendar.ics");
    expect(encodedSeparator).toBe("/api/users/:id/calendar.ics");
    expect(normalized).not.toContain("feed-token-0123456789");
    expect(encodedSeparator).not.toContain("feed-token-0123456789");
  });

  it("记录安全的请求开始日志和指标", () => {
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

  it("跳过指标端点", () => {
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

  it("记录响应状态、耗时和认证模式", async () => {
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

  it("在重新抛出前记录抛出的路由错误", async () => {
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
