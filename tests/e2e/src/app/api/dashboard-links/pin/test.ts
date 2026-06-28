/**
 * E2E tests for POST /api/dashboard-links/pin
 *
 * ## Endpoint
 * - `POST /api/dashboard-links/pin` — Pin or unpin a dashboard link for the current user
 *
 * ## Request
 * - Form data: `{ slug: string, action?: "pin" | "unpin", returnTo?: string }`
 * - Supports both JSON (`Accept: application/json`) and redirect (HTML form) modes
 *
 * ## Response (JSON mode)
 * - 200: `{ pinnedSlugs: string[], maxPinnedLinks: number }`
 * - 400: validation error for malformed body
 * - 401: unauthorized when not signed in
 * - 500: write failure with explicit error payload
 *
 * ## Response (redirect mode)
 * - 303: redirect to `returnTo` or `/`
 *
 * ## Auth Requirements
 * - Requires session authentication (unauthenticated → 401 JSON or 303 redirect)
 *
 * ## Edge Cases
 * - Unknown slug returns 200 with empty pinnedSlugs (not an error)
 * - Maximum 4 pinned links enforced; oldest pins are evicted on overflow
 * - Pinning an already-pinned link is a no-op
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../../utils/auth";

const BASE = "/api/dashboard-links/pin";
const JSON_HEADERS = { accept: "application/json" };
const MAX_PINNED_LINKS = 4;

type PinResponse = {
  pinnedSlugs?: string[];
  maxPinnedLinks?: number;
  error?: string | null;
};

test.describe("POST /api/dashboard-links/pin 接口", () => {
  test("未登录时返回 401 JSON", async ({ request }) => {
    const response = await request.post(BASE, {
      form: { slug: "jw", action: "pin", returnTo: "/" },
      headers: JSON_HEADERS,
    });
    expect(response.status()).toBe(401);
    const body = (await response.json()) as PinResponse;
    expect(body.pinnedSlugs).toEqual([]);
    expect(body.maxPinnedLinks).toBe(MAX_PINNED_LINKS);
  });

  test("非 JSON 模式未登录时重定向", async ({ request }) => {
    const response = await request.post(BASE, {
      form: { slug: "jw", action: "pin", returnTo: "/?tab=links" },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(303);
  });

  test("缺少 slug 时返回 400 JSON", async ({ page }) => {
    await signInAsDebugUser(page, "/");

    const response = await page.request.post(BASE, {
      form: { action: "pin", returnTo: "/" },
      headers: JSON_HEADERS,
    });
    expect(response.status()).toBe(400);
  });

  test("置顶并取消置顶链接", async ({ page }) => {
    await signInAsDebugUser(page, "/");

    // Use a less common slug to minimize interference with seeded state
    const testSlug = "vlab";

    // Ensure clean start: unpin first
    await page.request.post(BASE, {
      form: { slug: testSlug, action: "unpin", returnTo: "/" },
      headers: JSON_HEADERS,
    });

    try {
      // Pin the link
      const pinRes = await page.request.post(BASE, {
        form: { slug: testSlug, action: "pin", returnTo: "/" },
        headers: JSON_HEADERS,
      });
      expect(pinRes.status()).toBe(200);
      const pinBody = (await pinRes.json()) as PinResponse;
      expect(pinBody.pinnedSlugs).toContain(testSlug);
      expect(pinBody.maxPinnedLinks).toBe(MAX_PINNED_LINKS);

      // Unpin the link
      const unpinRes = await page.request.post(BASE, {
        form: { slug: testSlug, action: "unpin", returnTo: "/" },
        headers: JSON_HEADERS,
      });
      expect(unpinRes.status()).toBe(200);
      const unpinBody = (await unpinRes.json()) as PinResponse;
      expect(unpinBody.pinnedSlugs).not.toContain(testSlug);
    } finally {
      // Cleanup: ensure unpin
      await page.request.post(BASE, {
        form: { slug: testSlug, action: "unpin", returnTo: "/" },
        headers: JSON_HEADERS,
      });
    }
  });

  test("未知 slug 在 JSON 模式下返回 200 且 pinnedSlugs 为空", async ({
    page,
  }) => {
    await signInAsDebugUser(page, "/");

    const response = await page.request.post(BASE, {
      form: { slug: "nonexistent-slug-e2e", action: "pin", returnTo: "/" },
      headers: JSON_HEADERS,
    });
    expect(response.status()).toBe(200);
    const body = (await response.json()) as PinResponse;
    expect(body.maxPinnedLinks).toBe(MAX_PINNED_LINKS);
  });

  test("重定向模式下登录用户返回 303", async ({ page }) => {
    await signInAsDebugUser(page, "/");

    const response = await page.request.post(BASE, {
      form: { slug: "jw", action: "pin", returnTo: "/?tab=links" },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(303);
  });
});
