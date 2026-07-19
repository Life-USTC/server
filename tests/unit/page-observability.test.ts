import { afterEach, describe, expect, it, vi } from "vitest";
import { setCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import {
  appendPageServerTiming,
  recordPageRequestFinish,
} from "@/lib/metrics/page-observability";

describe("页面性能可观测性", () => {
  afterEach(() => {
    setCloudflareRuntimeEnv(undefined);
    vi.restoreAllMocks();
  });

  it("保留已有 Server-Timing 并追加已测量的通用阶段", () => {
    const headers = new Headers({ "Server-Timing": "cache;dur=2" });

    appendPageServerTiming(headers, {
      appDurationMs: 42.25,
      authDurationMs: 3,
      totalDurationMs: 47.75,
    });

    expect(headers.get("Server-Timing")).toBe(
      "cache;dur=2, auth;dur=3, app;dur=42, total;dur=48",
    );
  });

  it("写入不包含 URL、查询参数或用户标识的页面数据点", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const writeDataPoint = vi.fn();
    setCloudflareRuntimeEnv({ ANALYTICS: { writeDataPoint } });

    recordPageRequestFinish({
      authMode: "authenticated",
      locale: "zh-cn",
      method: "GET",
      requestId: "request-id-only-in-logs",
      responseBytes: 12345,
      routeId: "/courses/[jwId]",
      status: 200,
      timings: {
        appDurationMs: 80,
        authDurationMs: 12,
        totalDurationMs: 95,
      },
    });

    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: ["page:/courses/[jwId]"],
      blobs: [
        "page_request",
        "/courses/[jwId]",
        "GET",
        "200",
        "2xx",
        "zh-cn",
        "authenticated",
        "response_bytes_known",
      ],
      doubles: [95, 200, 12345, 12, 80],
    });
    expect(JSON.stringify(writeDataPoint.mock.calls)).not.toContain(
      "request-id-only-in-logs",
    );
  });

  it("对未匹配路由和未知响应大小使用低基数标记", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const writeDataPoint = vi.fn();
    setCloudflareRuntimeEnv({ ANALYTICS: { writeDataPoint } });

    recordPageRequestFinish({
      authMode: "anonymous",
      locale: "en-us",
      method: "GET",
      requestId: "request-2",
      routeId: null,
      status: 404,
      timings: {
        appDurationMs: 5,
        authDurationMs: 0,
        totalDurationMs: 6,
      },
    });

    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: ["page:unmatched"],
      blobs: [
        "page_request",
        "unmatched",
        "GET",
        "404",
        "4xx",
        "en-us",
        "anonymous",
        "response_bytes_unknown",
      ],
      doubles: [6, 404, 0, 0, 5],
    });
  });

  it("Analytics Engine 失败不影响页面响应路径", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    setCloudflareRuntimeEnv({
      ANALYTICS: {
        writeDataPoint: vi.fn(() => {
          throw new Error("analytics unavailable");
        }),
      },
    });

    expect(() =>
      recordPageRequestFinish({
        authMode: "anonymous",
        locale: "zh-cn",
        method: "GET",
        requestId: "request-3",
        routeId: "/",
        status: 200,
        timings: {
          appDurationMs: 20,
          authDurationMs: 0,
          totalDurationMs: 21,
        },
      }),
    ).not.toThrow();
  });
});
