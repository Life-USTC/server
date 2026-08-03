import {
  DEV_ADMIN_PROVIDER_ID,
  DEV_DEBUG_PROVIDER_ID,
} from "@/lib/auth/provider-ids";
import { expect, type APIRequestContext } from "@playwright/test";

async function signInWithProvider(
  request: APIRequestContext,
  providerId: string,
  callbackUrl = "/",
) {
  const response = await request.post("/account/sign-in", {
    form: {
      providerId,
      callbackUrl,
    },
  });
  expect([200, 302, 303]).toContain(response.status());

  await expect(async () => {
    const sessionResponse = await request.get("/api/auth/get-session");
    expect(sessionResponse.status()).toBe(200);
    const session = (await sessionResponse.json()) as {
      user?: { id?: string; isAdmin?: boolean };
    } | null;
    expect(typeof session?.user?.id).toBe("string");
    if (providerId === DEV_ADMIN_PROVIDER_ID) {
      expect(session?.user?.isAdmin).toBe(true);
    } else {
      expect(session?.user?.isAdmin).toBe(false);
    }
  }).toPass({ timeout: 15_000 });
}

export async function signInAsDebugUserApi(
  request: APIRequestContext,
  callbackUrl = "/",
) {
  await signInWithProvider(request, DEV_DEBUG_PROVIDER_ID, callbackUrl);
}

export async function signInAsDevAdminApi(
  request: APIRequestContext,
  callbackUrl = "/",
) {
  await signInWithProvider(request, DEV_ADMIN_PROVIDER_ID, callbackUrl);
}
