import { passkey } from "@better-auth/passkey";
import { getOptionalTrimmedEnv, isAppProductionBuildPhase } from "@/app-env";
import { getPasskeyAllowedOrigins } from "@/lib/auth/auth-origins";
import { getCanonicalOrigin } from "@/lib/site-url";

const PASSKEY_RP_NAME = "Life@USTC";
const LOCAL_PASSKEY_HOSTS = new Set(["localhost", "127.0.0.1"]);

export const betterAuthPasskeyRateLimitRules = {
  "/passkey/generate-authenticate-options": {
    window: 60,
    max: 20,
  },
  "/passkey/verify-authentication": {
    window: 60,
    max: 10,
  },
} as const;

function requireConfiguredProductionOrigin() {
  if (
    getOptionalTrimmedEnv("NODE_ENV") !== "production" ||
    isAppProductionBuildPhase()
  ) {
    return;
  }

  if (
    !getOptionalTrimmedEnv("APP_CANONICAL_ORIGIN") &&
    !getOptionalTrimmedEnv("APP_PUBLIC_ORIGIN")
  ) {
    throw new Error(
      "APP_CANONICAL_ORIGIN or APP_PUBLIC_ORIGIN is required for passkeys in production",
    );
  }
}

function validatePasskeyOrigin(origin: string) {
  const url = new URL(origin);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Passkey origins must use http or https");
  }
  if (url.protocol !== "https:" && !LOCAL_PASSKEY_HOSTS.has(url.hostname)) {
    throw new Error("Non-local passkey origins must use https");
  }
  return url.origin;
}

function validateOriginForRpId(origin: string, rpID: string) {
  const normalizedOrigin = validatePasskeyOrigin(origin);
  const hostname = new URL(normalizedOrigin).hostname;
  const matchesRpId =
    hostname === rpID ||
    (!LOCAL_PASSKEY_HOSTS.has(rpID) && hostname.endsWith(`.${rpID}`));
  if (!matchesRpId) {
    throw new Error(
      `Passkey origin ${normalizedOrigin} is not compatible with RP ID ${rpID}`,
    );
  }
  return normalizedOrigin;
}

export function buildBetterAuthPasskeyPlugin() {
  requireConfiguredProductionOrigin();
  const canonicalOrigin = validatePasskeyOrigin(getCanonicalOrigin());
  const rpID = new URL(canonicalOrigin).hostname;
  const allowedOrigins = getPasskeyAllowedOrigins().map((origin) =>
    validateOriginForRpId(origin, rpID),
  );

  return passkey({
    rpID,
    rpName: PASSKEY_RP_NAME,
    origin: allowedOrigins,
    registration: {
      requireSession: true,
    },
  });
}
