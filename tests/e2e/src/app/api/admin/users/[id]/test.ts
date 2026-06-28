/**
 * E2E tests for PATCH /api/admin/users/[id]
 *
 * Admin-only endpoint to update a single user's profile.
 *
 * - PATCH accepts optional fields: name, username, isAdmin
 * - Username validation enforces `^[a-z0-9-]{1,20}$`
 * - Duplicate username (belonging to another user) returns 400
 * - Returns the updated user object wrapped in `{ user: {...} }`
 * - Returns 401 for unauthenticated or non-admin requests
 * - Returns 400 for invalid body or username format
 */
import { expect, test } from "@playwright/test";
import {
  signInAsDebugUser,
  signInAsDevAdmin,
} from "../../../../../../utils/auth";
import { assertApiContract } from "../../../../_shared/api-contract";

const BASE = "/api/admin/users";

test.describe("PATCH /api/admin/users/[id] 用户更新", () => {
  test("API 契约", async ({ request }) => {
    await assertApiContract(request, { routePath: `${BASE}/[id]` });
  });

  test("未认证 PATCH 返回 401", async ({ request }) => {
    const response = await request.patch(`${BASE}/nonexistent-id`, {
      data: { name: "test" },
    });
    expect(response.status()).toBe(401);
  });

  test("非管理员 PATCH 返回 401", async ({ page }) => {
    await signInAsDebugUser(page, "/");
    const response = await page.request.patch(`${BASE}/nonexistent-id`, {
      data: { name: "test" },
    });
    expect(response.status()).toBe(401);
  });

  test("无效用户名格式返回 400", async ({ page }) => {
    await signInAsDevAdmin(page, "/admin");
    const listResponse = await page.request.get(`${BASE}?limit=1`);
    expect(listResponse.status()).toBe(200);
    const userId = (
      (await listResponse.json()) as {
        data?: Array<{ id?: string }>;
      }
    ).data?.[0]?.id;
    expect(userId).toBeTruthy();

    const response = await page.request.patch(`${BASE}/${userId}`, {
      data: { username: "INVALID_USERNAME" },
    });
    expect(response.status()).toBe(400);
  });
});
