/**
 * E2E tests for GET /api/account.
 *
 * Authenticated profile endpoint used by lightweight clients and mirrored by
 * the account_profile_get MCP tool.
 */
import { expect } from "@playwright/test";
import { authAccounts, signIn, test } from "../_harness/auth";

const BASE = "/api/account/profile";

test.describe("GET /api/account/profile - 当前账户资料", () => {
  test("未认证时返回 401", async ({ run, request }) => {
    await run(async () => {
      const response = await request.get(BASE);
      expect(response.status()).toBe(401);
    });
  });

  test("返回已认证用户资料字段", async ({ run, request, account }) => {
    await run(async () => {
      await signIn(request, account);

      const sessionResponse = await request.get("/api/auth/get-session");
      expect(sessionResponse.status()).toBe(200);
      const session = (await sessionResponse.json()) as {
        user?: { id?: string; username?: string | null };
      };

      const response = await request.get(BASE);
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        id?: string;
        email?: string | null;
        name?: string | null;
        image?: string | null;
        username?: string | null;
        isAdmin?: boolean;
        createdAt?: string;
        updatedAt?: string;
      };

      expect(body.id).toBe(session.user?.id);
      expect(typeof body.email).toBe("string");
      expect(body.name).toBe(authAccounts.user.name);
      expect(body.username).toBe(session.user?.username ?? null);
      expect(body.isAdmin).toBe(false);
      expect(body.image === null || typeof body.image === "string").toBe(true);
      expect(body.createdAt).toMatch(/\+08:00$/);
      expect(body.updatedAt).toMatch(/\+08:00$/);
    });
  });
});
