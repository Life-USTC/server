/**
 * E2E tests for GET /api/admin/comments
 *
 * Admin-only endpoint listing comments for moderation.
 *
 * - GET returns `{ comments: [...] }` with detailed includes (user, section, course, etc.)
 * - Supports `status` filter: "active", "softbanned", "deleted", "suspended"
 *   - "suspended" filters by users with active suspensions
 * - Supports `limit` parameter (default 50, max 200)
 * - Comments are ordered by createdAt descending
 * - Returns 401 for unauthenticated or non-admin requests
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser, signInAsDevAdmin } from "../../../../../utils/auth";
import { assertApiContract } from "../../../_shared/api-contract";

const BASE = "/api/admin/comments";

test.describe("GET /api/admin/comments 评论列表", () => {
  test("API 契约", async ({ request }) => {
    await assertApiContract(request, { routePath: BASE });
  });

  test("未认证请求返回 401", async ({ request }) => {
    const response = await request.get(BASE);
    expect(response.status()).toBe(401);
  });

  test("非管理员认证用户返回 401", async ({ page }) => {
    await signInAsDebugUser(page, "/");
    const response = await page.request.get(BASE);
    expect(response.status()).toBe(401);
  });

  test("管理员可按 status=softbanned 筛选评论", async ({ page }) => {
    await signInAsDevAdmin(page, "/admin");
    const response = await page.request.get(`${BASE}?status=softbanned`);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      comments?: Array<{ status?: string }>;
    };
    expect((body.comments?.length ?? 0) > 0).toBe(true);
    expect(body.comments?.every((item) => item.status === "softbanned")).toBe(
      true,
    );
  });

  test("管理员可无状态筛选列出活跃评论", async ({ page }) => {
    await signInAsDevAdmin(page, "/admin");
    const response = await page.request.get(`${BASE}?limit=5`);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      comments?: Array<{ id?: string; status?: string }>;
    };
    expect((body.comments?.length ?? 0) > 0).toBe(true);
    expect(body.comments?.length).toBeLessThanOrEqual(5);
    expect(body.comments?.every((item) => item.status === "active")).toBe(true);
  });
});
