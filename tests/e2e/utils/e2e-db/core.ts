import { randomBytes } from "node:crypto";
import { expect, type Page } from "@playwright/test";

export const PLAYWRIGHT_BASE_URL = "http://127.0.0.1:3000";

export function generateToken(bytes = 24) {
  return randomBytes(bytes).toString("base64url");
}

export async function getCurrentSessionUser(page: Page) {
  const response = await page.request.get("/api/auth/get-session");
  expect(response.status()).toBe(200);
  const session = (await response.json()) as {
    user?: {
      id?: string;
      username?: string | null;
      isAdmin?: boolean;
    };
  };
  expect(typeof session.user?.id).toBe("string");
  return session.user as {
    id: string;
    username?: string | null;
    isAdmin?: boolean;
  };
}
