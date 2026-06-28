/**
 * E2E tests for GET /api/readiness
 *
 * 内部依赖就绪状态检查端点。
 *
 * - 本地请求（127.0.0.1/localhost）可直接访问；非本地请求需要 Bearer Token
 *   （READINESS_BEARER_TOKEN 或 METRICS_BEARER_TOKEN），否则返回 404。
 * - 返回 { status, uptimeSeconds, checks: { database, storage } }
 * - 当数据库与存储均正常时返回 200 / status: "ok"
 * - 当任一检查异常时返回 503 / status: "degraded"
 */
import { expect, test } from "@playwright/test";

const BASE = "/api/readiness";

test.describe("GET /api/readiness 就绪状态", () => {
  test("API 契约：返回状态、运行时长与检查项", async ({ request }) => {
    const response = await request.get(BASE);
    const status = response.status();

    expect(status === 200 || status === 503).toBe(true);

    const body = (await response.json()) as {
      status?: string;
      uptimeSeconds?: number;
      checks?: {
        database?: { status?: string; durationMs?: number };
        storage?: { status?: string; binding?: string };
      };
    };

    expect(body.status).toBe(status === 200 ? "ok" : "degraded");
    expect(typeof body.uptimeSeconds).toBe("number");
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);

    expect(body.checks).toBeDefined();
    expect(body.checks?.database).toBeDefined();
    expect(body.checks?.database?.status).toMatch(/^(ok|error)$/);
    expect(typeof body.checks?.database?.durationMs).toBe("number");

    expect(body.checks?.storage).toBeDefined();
    expect(body.checks?.storage?.binding).toBe("R2_UPLOADS");
    expect(body.checks?.storage?.status).toMatch(/^(ok|missing_r2_binding)$/);
  });

  test("匿名本地请求可访问并返回有效响应", async ({ request }) => {
    const response = await request.get(BASE);
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(600);

    const body = (await response.json()) as {
      status?: string;
      checks?: {
        database?: { status?: string };
        storage?: { status?: string };
      };
    };
    expect(["ok", "degraded"]).toContain(body.status);
    expect(body.checks?.database?.status).toMatch(/^(ok|error)$/);
    expect(body.checks?.storage?.status).toMatch(/^(ok|missing_r2_binding)$/);
  });

  test("不支持 POST 请求", async ({ request }) => {
    const response = await request.post(BASE);
    expect(response.status()).toBe(405);
  });
});
