import { getCanonicalOrigin, getPublicOrigin } from "@/lib/site-url";

const LOCALHOST_DEV_PORT = 3000;
const LOCALHOST_AUTH_ORIGINS = [
  `http://localhost:${LOCALHOST_DEV_PORT}`,
  `http://127.0.0.1:${LOCALHOST_DEV_PORT}`,
];
const VERCEL_PREVIEW_AUTH_ORIGIN = "https://*.vercel.app";

function uniqueOrigins(origins: string[]): string[] {
  return Array.from(new Set(origins));
}

function normalizeOriginOrNull(origin: string): string | null {
  try {
    return new URL(origin).origin;
  } catch {
    return null;
  }
}

export function getAuthTrustedOrigins(): string[] {
  return uniqueOrigins([
    getPublicOrigin(),
    getCanonicalOrigin(),
    ...LOCALHOST_AUTH_ORIGINS,
    VERCEL_PREVIEW_AUTH_ORIGIN,
  ]);
}

export function getAuthAllowedHosts(): string[] {
  return uniqueOrigins(
    getAuthTrustedOrigins().map((origin) => new URL(origin).host),
  );
}

function isWildcardOriginPattern(origin: string) {
  return origin.includes("://*.");
}

function matchesTrustedOrigin(origin: string, trustedOrigin: string) {
  if (!isWildcardOriginPattern(trustedOrigin)) {
    return origin === trustedOrigin;
  }

  const trustedUrl = new URL(trustedOrigin);
  const trustedHostSuffix = trustedUrl.hostname.slice(1);
  const url = new URL(origin);
  return (
    url.protocol === trustedUrl.protocol &&
    url.hostname.endsWith(trustedHostSuffix) &&
    url.hostname.length > trustedHostSuffix.length
  );
}

export function isTrustedAuthOrigin(origin: string): boolean {
  const normalizedOrigin = normalizeOriginOrNull(origin);
  if (!normalizedOrigin) {
    return false;
  }

  return getAuthTrustedOrigins().some((trustedOrigin) =>
    matchesTrustedOrigin(normalizedOrigin, trustedOrigin),
  );
}
