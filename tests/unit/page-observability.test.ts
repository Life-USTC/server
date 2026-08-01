import { afterEach, describe, expect, it, vi } from "vitest";
import { setCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import {
  recordPageRequestError,
  recordPageRequestFinish,
} from "@/lib/metrics/page-observability";

describe("页面性能可观测性", () => {
  afterEach(() => {
    setCloudflareRuntimeEnv(undefined);
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("写入不包含 URL、查询参数或用户标识的页面数据点", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const writeDataPoint = vi.fn();
    setCloudflareRuntimeEnv({ ANALYTICS: { writeDataPoint } });

    recordPageRequestFinish({
      attribution: {
        authSignalPresence: "present",
        catalogDetailTab: "not_applicable",
        ssrClass: "dynamic-ssr",
      },
      authMode: "authenticated",
      locale: "zh-cn",
      method: "GET",
      requestId: "request-id-only-in-logs",
      responseBytes: 12345,
      routeId: "/catalog/courses/[jwId]",
      status: 200,
      timings: {
        appIoObservedDurationMs: 80,
        authIoObservedDurationMs: 12,
        totalIoObservedDurationMs: 95,
      },
    });

    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: ["page:/catalog/courses/[jwId]"],
      blobs: [
        "page_request_v2",
        "finish",
        "/catalog/courses/[jwId]",
        "GET",
        "200",
        "2xx",
        "zh-cn",
        "authenticated",
        "response_bytes_known",
        "dynamic-ssr",
        "present",
        "not_applicable",
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
      attribution: {
        authSignalPresence: "absent",
        catalogDetailTab: "not_applicable",
        ssrClass: "dynamic-ssr",
      },
      authMode: "anonymous",
      locale: "en-us",
      method: "GET",
      requestId: "request-2",
      routeId: null,
      status: 404,
      timings: {
        appIoObservedDurationMs: 5,
        authIoObservedDurationMs: 0,
        totalIoObservedDurationMs: 6,
      },
    });

    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: ["page:unmatched"],
      blobs: [
        "page_request_v2",
        "finish",
        "unmatched",
        "GET",
        "404",
        "4xx",
        "en-us",
        "anonymous",
        "response_bytes_unknown",
        "dynamic-ssr",
        "absent",
        "not_applicable",
      ],
      doubles: [6, 404, 0, 0, 5],
    });
  });

  it("生产环境下采样普通成功日志但保留完整 Analytics 数据点", () => {
    vi.stubEnv("NODE_ENV", "production");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const writeDataPoint = vi.fn();
    setCloudflareRuntimeEnv({ ANALYTICS: { writeDataPoint } });

    recordPageRequestFinish({
      attribution: {
        authSignalPresence: "absent",
        catalogDetailTab: "not_applicable",
        ssrClass: "dynamic-ssr",
      },
      authMode: "anonymous",
      locale: "zh-cn",
      method: "GET",
      requestId: "request-1",
      routeId: "/privacy",
      status: 200,
      timings: {
        appIoObservedDurationMs: 5,
        authIoObservedDurationMs: 0,
        totalIoObservedDurationMs: 6,
      },
    });

    expect(info).not.toHaveBeenCalled();
    expect(writeDataPoint).toHaveBeenCalledOnce();
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
        attribution: {
          authSignalPresence: "absent",
          catalogDetailTab: "not_applicable",
          ssrClass: "dynamic-ssr",
        },
        authMode: "anonymous",
        locale: "zh-cn",
        method: "GET",
        requestId: "request-3",
        routeId: "/",
        status: 200,
        timings: {
          appIoObservedDurationMs: 20,
          authIoObservedDurationMs: 0,
          totalIoObservedDurationMs: 21,
        },
      }),
    ).not.toThrow();
  });

  it("logs returned page 5xx responses at error severity", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    recordPageRequestFinish({
      attribution: {
        authSignalPresence: "absent",
        catalogDetailTab: "not_applicable",
        ssrClass: "dynamic-ssr",
      },
      authMode: "anonymous",
      locale: "zh-cn",
      method: "POST",
      requestId: "request-500",
      routeId: "/account/settings/authorizations",
      status: 500,
      timings: {
        appIoObservedDurationMs: 4,
        authIoObservedDurationMs: 1,
        totalIoObservedDurationMs: 6,
      },
    });

    expect(error).toHaveBeenCalledWith(
      "[app]",
      expect.objectContaining({
        event: "page.request.finish",
        requestId: "request-500",
        status: 500,
      }),
    );
  });

  it("records unexpected page errors with safe correlation fields", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const writeDataPoint = vi.fn();
    setCloudflareRuntimeEnv({ ANALYTICS: { writeDataPoint } });

    recordPageRequestError({
      attribution: {
        authSignalPresence: "present",
        catalogDetailTab: "not_applicable",
        ssrClass: "dynamic-ssr",
      },
      authMode: "authenticated",
      errorName: "TypeError",
      locale: "en-us",
      method: "POST",
      requestId: "request-error",
      routeId: "/account/settings/authorizations",
      timings: {
        appIoObservedDurationMs: 8,
        authIoObservedDurationMs: 2,
        totalIoObservedDurationMs: 11,
      },
    });

    expect(error).toHaveBeenCalledWith(
      "[app]",
      expect.objectContaining({
        errorName: "TypeError",
        event: "page.request.error",
        ioObservedDurationMs: 11,
        requestId: "request-error",
        route: "/account/settings/authorizations",
        status: 500,
      }),
    );
    expect(writeDataPoint).toHaveBeenCalledWith(
      expect.objectContaining({
        blobs: expect.arrayContaining(["page_request_v2", "error"]),
        doubles: [11, 500, 0, 2, 8],
      }),
    );
  });
});
