/**
 * E2E tests for GET & POST /api/dashboard-links/visit
 *
 * ## Endpoints
 * - `GET /api/dashboard-links/visit?slug=X` — Redirect to the dashboard link URL (no side effects)
 * - `POST /api/dashboard-links/visit` — Record a visit click and redirect to the link URL
 *
 * ## GET Request
 * - Query: `{ slug: string }`
 * - 307: redirect to the link's URL
 * - Invalid/missing slug: redirect to /
 *
 * ## POST Request
 * - Form data: `{ slug: string }`
 * - 303: redirect to the link's URL
 * - Records click count for authenticated users (upsert with increment)
 * - Invalid/missing slug: 303 redirect to /
 *
 * ## Auth Requirements
 * - GET: no auth required (pure redirect)
 * - POST: no auth required for redirect, but click is only recorded when authenticated
 *
 * ## Edge Cases
 * - Invalid slug redirects to / instead of erroring
 * - Click recording is best-effort (failures are logged, not surfaced)
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../../utils/auth";

const BASE = "/api/dashboard-links/visit";

test.describe("GET & POST /api/dashboard-links/visit 接口", () => {
  test("GET 重定向到目标链接 URL", async ({ request }) => {
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

  test("POST 有效 slug 重定向到目标 URL", async ({ page }) => {
    await signInAsDebugUser(page, "/");

    const response = await page.request.post(BASE, {
      form: { slug: "jw" },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(303);
    expect(response.headers().location).toBe("https://jw.ustc.edu.cn/");
  });

  test("POST 无效 slug 重定向到 /", async ({ page }) => {
    await signInAsDebugUser(page, "/");

    const response = await page.request.post(BASE, {
      form: { slug: "nonexistent-e2e" },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(303);
    expect(response.headers().location).toMatch(/\/$/);
  });

  test("POST 未登录仍重定向", async ({ request }) => {
    const response = await request.post(BASE, {
      form: { slug: "jw" },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(303);
    expect(response.headers().location).toBe("https://jw.ustc.edu.cn/");
  });
});
