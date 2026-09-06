/**
 * E2E tests for GET /api/catalog/links/resolve
 *
 * ## Endpoints
 * - `GET /api/catalog/links/resolve?slug=X` — Record an authenticated visit
 *   (best-effort) and redirect to the workspace link URL
 *
 * ## GET Request
 * - Query: `{ slug: string }`
 * - 307: redirect to the link's URL
 * - Records click count for authenticated users (upsert with increment)
 * - Invalid/missing slug: redirect to /
 *
 * ## Auth Requirements
 * - No auth required for redirect; click is only recorded when authenticated
 *
 * ## Edge Cases
 * - Invalid slug redirects to / instead of erroring
 * - Click recording is best-effort (failures are logged, not surfaced)
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUserApi } from "../../_harness/auth";

const BASE = "/api/catalog/links/resolve";

test.describe("GET /api/catalog/links/resolve 接口", () => {
  test("GET 重定向到目标链接 URL", async ({ request }) => {
    const response = await request.get(`${BASE}?slug=jw`, {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe("https://jw.ustc.edu.cn/");
  });

  test("GET 登录后仍重定向到目标 URL", async ({ request }) => {
    await signInAsDebugUserApi(request, "/");

    const response = await request.get(`${BASE}?slug=jw`, {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe("https://jw.ustc.edu.cn/");
  });

  test("GET 无效 slug 重定向到 /", async ({ request }) => {
    const response = await request.get(`${BASE}?slug=nonexistent-e2e`, {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toMatch(/\/$/);
  });

  test("GET 缺少 slug 重定向到 /", async ({ request }) => {
    const response = await request.get(BASE, {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toMatch(/\/$/);
  });
});
