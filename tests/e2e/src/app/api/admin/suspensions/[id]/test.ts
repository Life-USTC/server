/**
 * E2E tests for PATCH /api/admin/suspensions/[id]
 *
 * Admin-only endpoint to lift (un-suspend) a single suspension.
 *
 * - PATCH sets liftedAt and liftedById on the suspension record and clears the user's open suspension state
 * - No request body is needed
 * - Returns the updated suspension in `{ suspension: {...} }`
 * - Returns 401 for unauthenticated or non-admin requests
 * - Returns 400 for invalid suspension ID
 */
import { expect, test } from "@playwright/test";
import {
  signInAsDebugUser,
  signInAsDevAdmin,
} from "../../../../../../utils/auth";
import {
  createTempUsersFixture,
  deleteUsersByPrefix,
} from "../../../../../../utils/e2e-db";
import { assertApiContract } from "../../../../_shared/api-contract";

const BASE = "/api/admin/suspensions";

test.describe("PATCH /api/admin/suspensions/[id] 解除封禁", () => {
  test("API 契约", async ({ request }) => {
    await assertApiContract(request, {
      routePath: `${BASE}/[id]`,
    });
  });

  test("未认证 PATCH 返回 401", async ({ request }) => {
    const response = await request.patch(`${BASE}/nonexistent-id`);
    expect(response.status()).toBe(401);
  });

  test("非管理员 PATCH 返回 401", async ({ page }) => {
    await signInAsDebugUser(page, "/");
    const response = await page.request.patch(`${BASE}/nonexistent-id`);
    expect(response.status()).toBe(401);
  });

  test("管理员可解除临时封禁", async ({ page }) => {
    const prefix = `e2e-lift-sus-${Date.now()}`;
    const { usernames } = await createTempUsersFixture({ prefix, count: 1 });
    await signInAsDevAdmin(page, "/admin");

    try {
      const userResponse = await page.request.get(
        `/api/admin/users?search=${usernames[0]}`,
      );
      expect(userResponse.status()).toBe(200);
      const userId = (
        (await userResponse.json()) as {
          data?: Array<{ id?: string; username?: string | null }>;
        }
      ).data?.find((user) => user.username === usernames[0])?.id;
      expect(userId).toBeTruthy();

      const createResponse = await page.request.post(BASE, {
        data: {
          userId,
          reason: `e2e-lift-suspension-${Date.now()}`,
        },
      });
      expect(createResponse.status()).toBe(200);
      const createBody = (await createResponse.json()) as {
        suspension?: { id?: string };
      };
      const suspensionId = createBody.suspension?.id;
      expect(suspensionId).toBeTruthy();

      const patchResponse = await page.request.patch(`${BASE}/${suspensionId}`);
      expect(patchResponse.status()).toBe(200);
      const patchBody = (await patchResponse.json()) as {
        suspension?: {
          id?: string;
          liftedAt?: string | null;
          liftedById?: string | null;
        };
      };
      expect(patchBody.suspension?.id).toBe(suspensionId);
      expect(patchBody.suspension?.liftedAt).toBeTruthy();
      expect(patchBody.suspension?.liftedById).toBeTruthy();
    } finally {
      await deleteUsersByPrefix(prefix);
    }
  });
});
