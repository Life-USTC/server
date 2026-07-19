import { passkeyClient } from "@better-auth/passkey/client";
import { createAuthClient } from "better-auth/svelte";

export const passkeyAuthClient = createAuthClient({
  plugins: [passkeyClient()],
});

export type PasskeyClientErrorKind =
  | "cancelled"
  | "duplicate"
  | "generic"
  | "stale-session";

function errorCode(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return null;
  }
  return typeof error.code === "string" ? error.code : null;
}

export function passkeyClientErrorKind(error: unknown): PasskeyClientErrorKind {
  const code = errorCode(error);
  if (code === "SESSION_NOT_FRESH") return "stale-session";
  if (
    code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED" ||
    code === "PREVIOUSLY_REGISTERED"
  ) {
    return "duplicate";
  }
  if (
    code === "AUTH_CANCELLED" ||
    code === "REGISTRATION_CANCELLED" ||
    code === "ERROR_CEREMONY_ABORTED" ||
    code === "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY"
  ) {
    return "cancelled";
  }
  return "generic";
}

export function isPasskeySupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential === "function" &&
    typeof navigator.credentials?.create === "function" &&
    typeof navigator.credentials?.get === "function"
  );
}
