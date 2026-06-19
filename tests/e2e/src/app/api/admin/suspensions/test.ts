/**
 * E2E tests for GET/POST /api/admin/suspensions
 *
 * Admin-only endpoint for listing and creating user suspensions.
 *
 * - GET returns `{ suspensions: [...] }` with user info, ordered by createdAt desc
 * - POST creates a new suspension; body: userId (required), reason, note, expiresAt
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

test.describe("GET/POST /api/admin/suspensions", () => {
  test("api contract", async ({ request }) => {
    await assertApiContract(request, { routePath: BASE });
  });

  test("unauthenticated GET returns 401", async ({ request }) => {
    const response = await request.get(BASE);
    expect(response.status()).toBe(401);
  });

  test("unauthenticated POST returns 401", async ({ request }) => {
    const response = await request.post(BASE, {
      data: { userId: "fake-id", reason: "test" },
    });
    expect(response.status()).toBe(401);
  });

  test("non-admin GET returns 401", async ({ page }) => {
    await signInAsDebugUser(page, "/");
    const response = await page.request.get(BASE);
    expect(response.status()).toBe(401);
  });

  test("admin can list suspensions and find seed record", async ({ page }) => {
    await signInAsDevAdmin(page, "/admin");

    const response = await page.request.get(BASE);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      suspensions?: Array<{ reason?: string | null }>;
    };
    expect(
      body.suspensions?.some((item) =>
        item.reason?.includes(DEV_SEED.suspensions.reasonKeyword),
      ),
    ).toBe(true);
  });

  test("POST with nonexistent userId returns 404", async ({ page }) => {
    await signInAsDevAdmin(page, "/admin");

    const response = await page.request.post(BASE, {
      data: { userId: "nonexistent-user-id-e2e", reason: "should fail" },
    });
    expect(response.status()).toBe(404);
  });

  test("POST with invalid expiresAt returns 400 and creates no suspension", async ({
    page,
  }) => {
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

      const postResponse = await page.request.post(BASE, {
        data: {
          userId,
          reason: "invalid expiration should fail",
          expiresAt: "not-a-date",
        },
      });
      expect(postResponse.status()).toBe(400);

      const listResponse = await page.request.get(BASE);
      expect(listResponse.status()).toBe(200);
      const body = (await listResponse.json()) as {
        suspensions?: Array<{ userId?: string }>;
      };
      expect(
        (body.suspensions ?? []).some((item) => item.userId === userId),
      ).toBe(false);
    } finally {
      await deleteUsersByPrefix(prefix);
    }
  });

  test("admin can create a suspension for a temp user", async ({ page }) => {
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
      expect(postResponse.status()).toBe(200);
      const postBody = (await postResponse.json()) as {
        suspension?: {
          expiresAt?: string | null;
          id?: string;
          userId?: string;
          reason?: string | null;
        };
      };
      expect(postBody.suspension?.userId).toBe(userId);
      expect(postBody.suspension?.reason).toBe("e2e suspension test");
      expect(postBody.suspension?.expiresAt).toBeNull();

      // Lift the suspension so user can be cleanly deleted.
      if (postBody.suspension?.id) {
        await page.request.patch(`${BASE}/${postBody.suspension.id}`);
      }
    } finally {
      await deleteUsersByPrefix(prefix);
    }
  });
});
