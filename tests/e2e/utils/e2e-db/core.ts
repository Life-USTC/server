import { randomBytes } from "node:crypto";
import { expect, type Page } from "@playwright/test";

const PLAYWRIGHT_HOST = "127.0.0.1";
const DEFAULT_PLAYWRIGHT_PORT = "3000";

export const PLAYWRIGHT_BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ??
  `http://${PLAYWRIGHT_HOST}:${process.env.PLAYWRIGHT_PORT ?? DEFAULT_PLAYWRIGHT_PORT}`;

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
