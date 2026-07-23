import { afterEach, describe, expect, it, vi } from "vitest";
import { setCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import {
  normalizeApiRoutePath,
  observedApiRoute,
  recordApiRequestStart,
  recordObservedApiResponse,
  setApiRequestObservabilityContext,
} from "@/lib/log/api-observability";

describe("API 可观测性", () => {
  afterEach(() => {
    setCloudflareRuntimeEnv(undefined);
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

  it("记录安全的请求开始日志", () => {
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
        event: "request.finish",
        ioObservedDurationMs: 1000,
        method: "GET",
        path: "/api/todos/:id",
        requestId: "request-1",
        status: 200,
      }),
    );
  });

  it("向 Cloudflare Analytics Engine 写入安全的请求结束数据点", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:01.000Z"));
    vi.spyOn(console, "info").mockImplementation(() => {});
    const writeDataPoint = vi.fn();
    setCloudflareRuntimeEnv({
      ANALYTICS: { writeDataPoint },
    });
    const route = observedApiRoute(() => new Response(null, { status: 204 }));

    await route(
      new Request(
        "https://example.test/api/users/user-1:feed-token-0123456789/calendar.ics",
        {
          headers: {
            authorization: "Bearer token-value",
            "x-request-id": "request-1",
            "x-request-start-ms": "1780790400000",
          },
        },
      ),
    );

    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: ["/api/users/:id/calendar.ics"],
      blobs: [
        "api_request_v2",
        "finish",
        "GET",
        "/api/users/:id/calendar.ics",
        "204",
        "2xx",
        "bearer",
      ],
      doubles: [1000, 204],
    });
    expect(JSON.stringify(writeDataPoint.mock.calls)).not.toContain(
      "feed-token-0123456789",
    );
  });

  it("Analytics Engine 写入失败不影响请求响应", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    setCloudflareRuntimeEnv({
      ANALYTICS: {
        writeDataPoint: vi.fn(() => {
          throw new Error("analytics unavailable");
        }),
      },
    });
    const route = observedApiRoute(() => Response.json({ ok: true }));

    const response = await route(
      new Request("https://example.test/api/todos/123"),
    );

    expect(response.status).toBe(200);
  });

  it("在重新抛出前记录抛出的路由错误", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:01.000Z"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
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

    expect(error).toHaveBeenCalledWith(
      "[api]",
      expect.objectContaining({
        authMode: "cookie",
        errorName: "Error",
        event: "request.error",
        ioObservedDurationMs: 1000,
        method: "GET",
        path: "/api/todos/:id",
        requestId: "request-1",
        status: 500,
      }),
    );
  });

  it("logs returned 5xx responses at error severity", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const route = observedApiRoute(() => new Response(null, { status: 503 }));

    await route(new Request("https://example.test/api/health"));

    expect(error).toHaveBeenCalledWith(
      "[api]",
      expect.objectContaining({
        event: "request.finish",
        status: 503,
      }),
    );
  });

  it("records completion exactly once across route and hook boundaries", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const request = new Request("https://example.test/api/todos/123");
    setApiRequestObservabilityContext(request, {
      requestId: "internal-request-id",
      startMs: Date.now(),
    });
    const route = observedApiRoute(() => new Response(null, { status: 204 }));

    await route(request);
    expect(recordObservedApiResponse(request, 204)).toBe(false);

    expect(
      info.mock.calls.filter(
        ([prefix, value]) =>
          prefix === "[api]" &&
          typeof value === "object" &&
          value !== null &&
          "event" in value &&
          value.event === "request.finish",
      ),
    ).toHaveLength(1);
  });
});
