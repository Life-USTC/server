/**
 * E2E tests for GET/POST /api/admin/suspensions
 *
 * Admin-only endpoint for listing and creating user suspensions.
 *
 * - GET returns `{ data: [...] }` with user info, ordered by createdAt desc
 * - POST creates a new suspension and closes any previous open suspension for the user
 * - POST body: userId (required), reason, note, expiresAt
 * - POST returns 404 if the target user does not exist
 * - POST returns 400 for invalid request body
 * - Both methods return 401 for unauthenticated or non-admin requests
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser, signInAsDevAdmin } from "../../../../../utils/auth";
import { DEV_SEED } from "../../../../../utils/dev-seed";
import {
  createTempUsersFixture,
  deleteUsersByPrefix,
} from "../../../../../utils/e2e-db";
import { assertApiContract } from "../../../_shared/api-contract";

const BASE = "/api/admin/suspensions";

test.describe("GET/POST /api/admin/suspensions 封禁管理", () => {
  test("API 契约", async ({ request }) => {
    await assertApiContract(request, { routePath: BASE });
  });

  test("未认证 GET 返回 401", async ({ request }) => {
    const response = await request.get(BASE);
    expect(response.status()).toBe(401);
  });

  test("未认证 POST 返回 401", async ({ request }) => {
    const response = await request.post(BASE, {
      data: { userId: "fake-id", reason: "test" },
    });
    expect(response.status()).toBe(401);
  });

  test("非管理员 GET 返回 401", async ({ page }) => {
    await signInAsDebugUser(page, "/");
    const response = await page.request.get(BASE);
    expect(response.status()).toBe(401);
  });

  test("管理员可列出封禁并找到 seed 记录", async ({ page }) => {
    await signInAsDevAdmin(page, "/admin");

    const response = await page.request.get(BASE);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      data?: Array<{ reason?: string | null }>;
    };
    expect(
      body.data?.some((item) =>
        item.reason?.includes(DEV_SEED.suspensions.reasonKeyword),
      ),
    ).toBe(true);
  });

  test("POST 不存在的 userId 返回 404", async ({ page }) => {
    await signInAsDevAdmin(page, "/admin");

    const response = await page.request.post(BASE, {
      data: { userId: "nonexistent-user-id-e2e", reason: "should fail" },
    });
    expect(response.status()).toBe(404);
  });

  test("POST 无效 expiresAt 返回 400 且不创建封禁", async ({ page }) => {
    const prefix = `e2e-sus-invalid-${Date.now()}`;
    const { usernames } = await createTempUsersFixture({ prefix, count: 1 });

    try {
      await signInAsDevAdmin(page, "/admin");

      const searchResponse = await page.request.get(
        `/api/admin/users?search=${usernames[0]}`,
      );
      expect(searchResponse.status()).toBe(200);
      const userId = (
        (await searchResponse.json()) as {
          data?: Array<{ id?: string; username?: string | null }>;
        }
      ).data?.find((u) => u.username === usernames[0])?.id;
      expect(userId).toBeTruthy();

      for (const expiresAt of [
        "not-a-date",
        "2026-02-31",
        "2026/02/31",
        "2026.02.31",
        "02/31/2026",
        "February 31, 2026",
      ]) {
        const postResponse = await page.request.post(BASE, {
          data: {
            userId,
            reason: "invalid expiration should fail",
            expiresAt,
          },
        });
        expect(postResponse.status()).toBe(400);
      }

      const listResponse = await page.request.get(BASE);
      expect(listResponse.status()).toBe(200);
      const body = (await listResponse.json()) as {
        data?: Array<{ userId?: string }>;
      };
      expect((body.data ?? []).some((item) => item.userId === userId)).toBe(
        false,
      );
    } finally {
      await deleteUsersByPrefix(prefix);
    }
  });

  test("管理员可为临时用户创建封禁", async ({ page }) => {
    const prefix = `e2e-sus-${Date.now()}`;
    const { usernames } = await createTempUsersFixture({ prefix, count: 1 });

    try {
      await signInAsDevAdmin(page, "/admin");

      // Resolve the temp user's ID.
      const searchResponse = await page.request.get(
        `/api/admin/users?search=${usernames[0]}`,
      );
      expect(searchResponse.status()).toBe(200);
      const userId = (
        (await searchResponse.json()) as {
          data?: Array<{ id?: string; username?: string | null }>;
        }
      ).data?.find((u) => u.username === usernames[0])?.id;
      expect(userId).toBeTruthy();

      // Create the suspension.
      const postResponse = await page.request.post(BASE, {
        data: {
          userId,
          reason: "e2e suspension test",
          note: "automated test",
        },
      });
      expect(postResponse.status()).toBe(201);
      const postBody = (await postResponse.json()) as {
        suspension?: {
          expiresAt?: string | null;
          id?: string;
          userId?: string;
          reason?: string | null;
        };
      };
      expect(postBody.suspension?.userId).toBe(userId);
      expect(postResponse.headers().location).toBe(
        `/api/admin/suspensions/${postBody.suspension?.id}`,
      );
      expect(postBody.suspension?.reason).toBe("e2e suspension test");
      expect(postBody.suspension?.expiresAt).toBeNull();

      const replacementResponse = await page.request.post(BASE, {
        data: {
          userId,
          reason: "e2e suspension replacement",
        },
      });
      expect(replacementResponse.status()).toBe(201);
      const replacementBody = (await replacementResponse.json()) as {
        suspension?: {
          id?: string;
          userId?: string;
          reason?: string | null;
        };
      };
      expect(replacementBody.suspension?.userId).toBe(userId);
      expect(replacementBody.suspension?.reason).toBe(
        "e2e suspension replacement",
      );

      const listResponse = await page.request.get(BASE);
      expect(listResponse.status()).toBe(200);
      const listBody = (await listResponse.json()) as {
        data?: Array<{
          id?: string;
          liftedAt?: string | null;
          userId?: string;
        }>;
      };
      const userSuspensions = (listBody.data ?? []).filter(
        (item) => item.userId === userId,
      );
      expect(
        userSuspensions.filter((item) => item.liftedAt === null),
      ).toHaveLength(1);
      expect(
        userSuspensions.some(
          (item) =>
            item.id === postBody.suspension?.id && item.liftedAt !== null,
        ),
      ).toBe(true);

      // Lift the suspension so user can be cleanly deleted.
      if (replacementBody.suspension?.id) {
        await page.request.patch(`${BASE}/${replacementBody.suspension.id}`);
      }
    } finally {
      await deleteUsersByPrefix(prefix);
    }
  });
});
