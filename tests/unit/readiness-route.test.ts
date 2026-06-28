import type { RequestEvent } from "@sveltejs/kit";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  renderPrometheusMetrics,
  resetRuntimeMetricsForTest,
} from "@/lib/metrics/runtime-metrics";

const { queryRawMock, storageReadinessMock } = vi.hoisted(() => ({
  queryRawMock: vi.fn(),
  storageReadinessMock: vi.fn(() => ({
    status: "ok",
    binding: "R2_UPLOADS",
  })),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $queryRaw: queryRawMock,
  },
}));

vi.mock("@/lib/storage/r2-object", () => ({
  storageReadiness: storageReadinessMock,
}));

function eventWithRequest(request: Request) {
  return { request } as RequestEvent;
}

describe("/api/readiness", () => {
  afterEach(() => {
    resetRuntimeMetricsForTest();
    queryRawMock.mockReset();
    storageReadinessMock.mockClear();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("为本地请求返回就绪检查", async () => {
    queryRawMock.mockResolvedValue([{ "?column?": 1 }]);
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { GET } = await import("@/routes/api/readiness/+server");

    const response = await GET(
      eventWithRequest(
        new Request("http://127.0.0.1:3000/api/readiness", {
          headers: { "x-request-id": "request-1" },
        }),
      ),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      status: "ok",
      checks: {
        database: { status: "ok" },
        storage: { status: "ok" },
      },
    });
    expect(typeof body.uptimeSeconds).toBe("number");

    expect(renderPrometheusMetrics()).toContain(
      'life_ustc_api_requests_total{auth_mode="anonymous",method="GET",route="/api/readiness",status="200"} 1',
    );
  });

  it("将降级就绪响应记录为 API 错误", async () => {
    queryRawMock.mockRejectedValue(new Error("database unavailable"));
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { GET } = await import("@/routes/api/readiness/+server");

    const response = await GET(
      eventWithRequest(
        new Request("http://127.0.0.1:3000/api/readiness", {
          headers: { "x-request-id": "request-503" },
        }),
      ),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: "degraded",
      checks: {
        database: { status: "error" },
        storage: { status: "ok" },
      },
    });

    const metrics = renderPrometheusMetrics();
    expect(metrics).toContain(
      'life_ustc_api_requests_total{auth_mode="anonymous",method="GET",route="/api/readiness",status="503"} 1',
    );
    expect(metrics).toContain(
      'life_ustc_api_errors_total{method="GET",route="/api/readiness",status="503"} 1',
    );
  });

  it("对无令牌的远程请求隐藏就绪状态", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { GET } = await import("@/routes/api/readiness/+server");

    const response = await GET(
      eventWithRequest(
        new Request("https://example.test/api/readiness", {
          headers: { host: "example.test" },
        }),
      ),
    );

    expect(response.status).toBe(404);
    expect(queryRawMock).not.toHaveBeenCalled();
  });
});
