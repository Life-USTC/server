import { sanitizeAuthCallbackUrl } from "@/lib/auth/auth-routing";

const WELCOME_CALLBACK_ORIGIN = "https://life-ustc.local";

export function resolveWelcomeCallbackUrl(value: unknown) {
  const callbackUrl = sanitizeAuthCallbackUrl(value);
  const callbackPath = new URL(callbackUrl, WELCOME_CALLBACK_ORIGIN).pathname;
  return callbackPath === "/account/welcome" ? "/" : callbackUrl;
}
