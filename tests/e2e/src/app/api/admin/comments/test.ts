/**
 * E2E tests for GET /api/admin/comments
 *
 * Admin-only endpoint listing comments for moderation.
 *
 * - GET returns `{ data: [...], pagination }` with detailed includes (user, section, course, etc.)
 * - Supports `status` filter: "active", "softbanned", "deleted", "suspended"
 *   - "suspended" filters by users with active suspensions
 * - Supports `page` and `pageSize` parameters (deprecated alias: `limit`)
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
      data?: Array<{ status?: string }>;
    };
    expect((body.data?.length ?? 0) > 0).toBe(true);
    expect(body.data?.every((item) => item.status === "softbanned")).toBe(true);
  });

  test("管理员可无状态筛选列出活跃评论", async ({ page }) => {
    await signInAsDevAdmin(page, "/admin");
    const response = await page.request.get(`${BASE}?pageSize=5`);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      data?: Array<{ id?: string; status?: string }>;
      pagination?: { page?: number; pageSize?: number; total?: number };
    };
    expect((body.data?.length ?? 0) > 0).toBe(true);
    expect(body.data?.length).toBeLessThanOrEqual(5);
    expect(body.data?.every((item) => item.status === "active")).toBe(true);
    expect(body.pagination).toMatchObject({ page: 1, pageSize: 5 });
  });

  test("管理员可翻到第二页且不会重复第一条评论", async ({ page }) => {
    await signInAsDevAdmin(page, "/admin");
    const firstResponse = await page.request.get(`${BASE}?page=1&pageSize=1`);
    const secondResponse = await page.request.get(`${BASE}?page=2&limit=1`);
    expect(firstResponse.status()).toBe(200);
    expect(secondResponse.status()).toBe(200);
    const first = (await firstResponse.json()) as {
      data?: Array<{ id?: string }>;
      pagination?: { total?: number };
    };
    const second = (await secondResponse.json()) as {
      data?: Array<{ id?: string }>;
      pagination?: { page?: number; pageSize?: number; total?: number };
    };
    expect((first.pagination?.total ?? 0) > 1).toBe(true);
    expect(second.pagination).toMatchObject({
      page: 2,
      pageSize: 1,
      total: first.pagination?.total,
    });
    expect(second.data?.[0]?.id).not.toBe(first.data?.[0]?.id);
  });
});
