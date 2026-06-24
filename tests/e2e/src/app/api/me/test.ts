/**
 * E2E tests for GET /api/me.
 *
 * Authenticated profile endpoint used by lightweight clients and mirrored by
 * the get_my_profile MCP tool.
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import { DEV_SEED } from "../../../../utils/dev-seed";

const BASE = "/api/me";

test.describe("GET /api/me", () => {
  test("returns 401 when not authenticated", async ({ request }) => {
    const response = await request.get(BASE);
    expect(response.status()).toBe(401);
  });

  test("returns authenticated profile fields", async ({ page }) => {
    await signInAsDebugUser(page, "/");

    const sessionResponse = await page.request.get("/api/auth/get-session");
    expect(sessionResponse.status()).toBe(200);
    const session = (await sessionResponse.json()) as {
      user?: { id?: string; username?: string | null };
    };

    const response = await page.request.get(BASE);
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
    expect(body.name).toBe(DEV_SEED.debugName);
    expect(body.username).toBe(session.user?.username ?? null);
    expect(body.isAdmin).toBe(false);
    expect(body.image === null || typeof body.image === "string").toBe(true);
    expect(body.createdAt).toMatch(/\+08:00$/);
    expect(body.updatedAt).toMatch(/\+08:00$/);
  });
});
