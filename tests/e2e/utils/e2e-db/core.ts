import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const PLAYWRIGHT_BASE_URL = "http://localhost:3000";

export function generateToken(bytes = 24) {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function getRequestFromSessionSource(source: APIRequestContext | Page) {
  return "request" in source ? source.request : source;
}

export async function getCurrentSessionUser(source: APIRequestContext | Page) {
  const response = await getRequestFromSessionSource(source).get(
    "/api/auth/get-session",
  );
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
