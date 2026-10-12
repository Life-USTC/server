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
import { expect } from "@playwright/test";
import { assertApiContract } from "../../../_shared/api-contract";
import { base as BASE, test } from "../_fixture";

test.describe("PATCH /api/admin/users/[id] 用户更新", () => {
  test("API 契约", { tag: "@Admin/REST" }, async ({ request, run }) =>
    run(async () => {
      await assertApiContract(request, { routePath: `${BASE}/[id]` });
    }),
  );
  test(
    "未认证 PATCH 返回 401",
    { tag: "@Admin/REST" },
    async ({ request, run }) =>
      run(async () => {
        const response = await request.patch(`${BASE}/nonexistent-id`, {
          data: { name: "test" },
        });
        expect(response.status()).toBe(401);
      }),
  );
  test(
    "非管理员 PATCH 返回 401",
    { tag: "@Admin/REST" },
    async ({ userState, run }) =>
      run(async () => {
        const { owner, adminUser, db } = userState;
        const response = await owner.request.patch(`${BASE}/${adminUser.id}`, {
          data: { name: "test" },
        });
        expect(response.status()).toBe(401);
        expect(
          await db.user.findUniqueOrThrow({ where: { id: adminUser.id } }),
        ).toEqual(adminUser);
        expect(await db.auditLog.count()).toBe(0);
      }),
  );
  test(
    "无效用户名格式返回 400",
    { tag: "@Admin/REST" },
    async ({ userState, run }) =>
      run(async () => {
        const { admin, ownerUser, db } = userState;
        const response = await admin.request.patch(`${BASE}/${ownerUser.id}`, {
          data: { username: "INVALID_USERNAME" },
        });
        expect(response.status()).toBe(400);
        expect(
          await db.user.findUniqueOrThrow({ where: { id: ownerUser.id } }),
        ).toEqual(ownerUser);
        expect(await db.auditLog.count()).toBe(0);
      }),
  );
});
