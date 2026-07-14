/**
 * E2E tests for GET /api/admin/users
 *
 * Admin-only endpoint that returns a paginated list of users.
 *
 * - GET returns `{ data, pagination }` with user objects
 *   containing id, name, username, isAdmin, email, createdAt
 * - Supports `search` query for filtering by id, name, username, or email
 * - Supports `page` and `pageSize` pagination parameters (deprecated `limit` alias, max 100)
 * - Returns 401 for unauthenticated or non-admin requests
 * - Returns 400 for invalid query parameters
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser, signInAsDevAdmin } from "../../../../../utils/auth";
import { DEV_SEED } from "../../../../../utils/dev-seed";
import { assertApiContract } from "../../../_shared/api-contract";

const BASE = "/api/admin/users";

test.describe("GET /api/admin/users 用户列表", () => {
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

  test("管理员可按用户名搜索 seed 用户", async ({ page }) => {
    await signInAsDevAdmin(page, "/admin");
    const response = await page.request.get(
      `${BASE}?search=${DEV_SEED.debugUsername}`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      data?: Array<{
        id?: string;
        username?: string | null;
        isAdmin?: boolean;
      }>;
      pagination?: {
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      };
    };
    expect(
      body.data?.some((item) => item.username === DEV_SEED.debugUsername),
    ).toBe(true);
    expect(body.pagination).toBeDefined();
    expect(typeof body.pagination?.total).toBe("number");
  });

  test("管理员可使用 pageSize=1 分页用户", async ({ page }) => {
    await signInAsDevAdmin(page, "/admin");
    const response = await page.request.get(`${BASE}?page=1&pageSize=1`);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      data?: unknown[];
      pagination?: { page: number; pageSize: number; totalPages: number };
    };
    expect(body.data?.length).toBe(1);
    expect(body.pagination?.page).toBe(1);
    expect(body.pagination?.pageSize).toBe(1);
  });
});
