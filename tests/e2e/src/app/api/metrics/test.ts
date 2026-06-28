/**
 * E2E tests for GET /api/metrics
 *
 * Prometheus 格式的内部运行指标端点。
 *
 * - GET 返回 text/plain 200，内容是 Prometheus 文本指标
 * - 未授权（非本机且未提供合法 bearer token）返回 404（notFoundText）
 * - 本机/127.0.0.1/localhost 请求可直接访问
 */
import { expect, test } from "@playwright/test";

const BASE = "/api/metrics";

test.describe("GET /api/metrics 运行时指标", () => {
  test("API 契约：返回 Prometheus text/plain 200", async ({ request }) => {
    const response = await request.get(BASE);

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/plain");

    const text = await response.text();
    expect(text).toContain("# Life USTC runtime metrics");
    // Prometheus 文本格式基本特征：至少包含若干指标行
    const lines = text.split("\n").filter((line) => line.length > 0);
    expect(lines.length).toBeGreaterThan(0);
  });

  test("本机请求无需 token 即可访问", async ({ request }) => {
    const response = await request.get(BASE);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/plain");
  });

  test("错误 bearer token 在本机请求下仍返回 200", async ({ request }) => {
    const response = await request.get(BASE, {
      headers: {
        authorization: "Bearer invalid-token",
      },
    });
    // isLocalRequest 为 true 时直接放行，不校验 token
    expect(response.status()).toBe(200);
  });
});
