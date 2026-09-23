/**
 * E2E tests for GET /api/health
 *
 * Public observability endpoint returning a plain-text liveness probe.
 *
 * - GET returns 200 with `text/plain; charset=utf-8` content type
 * - Response body is exactly `ok\n`
 * - No authentication required
 */
import { expect, test } from "@playwright/test";

const BASE = "/api/health";

test.describe("GET /api/health 健康检查", () => {
  test("API 契约：匿名访问返回 200 与 plain/text ok", async ({ request }) => {
    const response = await request.get(BASE);

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe(
      "text/plain; charset=utf-8",
    );
    expect(await response.text()).toBe("ok\n");
  });

  test("不支持非 GET 方法时返回 405", async ({ request }) => {
    const response = await request.post(BASE);
    expect(response.status()).toBe(405);
  });
});
