import { getPublicOrigin } from "@/lib/site-url";

function getLocalOriginAlternates(origin: string) {
  const url = new URL(origin);
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    return [
      origin,
      `http://${url.hostname === "localhost" ? "127.0.0.1" : "localhost"}${url.port ? `:${url.port}` : ""}`,
    ];
  }
  return [origin];
}
const DEFAULT_LOCAL_AUTH_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

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

function getLocalSiblingOrigin(origin: string): string | null {
  const url = new URL(origin);
  if (url.hostname === "localhost") {
    url.hostname = "127.0.0.1";
    return url.origin;
  }
  if (url.hostname === "127.0.0.1") {
    url.hostname = "localhost";
    return url.origin;
  }
  return null;
}

export function getAuthTrustedOrigins(): string[] {
  const publicOrigin = getPublicOrigin();
  const localSiblingOrigin = getLocalSiblingOrigin(publicOrigin);
  return uniqueOrigins([
    publicOrigin,
    ...(localSiblingOrigin ? [localSiblingOrigin] : []),
    ...getLocalOriginAlternates(publicOrigin),
    ...DEFAULT_LOCAL_AUTH_ORIGINS,
  ]);
}

export function getAuthAllowedHosts(): string[] {
  return uniqueOrigins(
    getAuthTrustedOrigins().map((origin) => new URL(origin).host),
  );
}

function matchesTrustedOrigin(origin: string, trustedOrigin: string) {
  return origin === trustedOrigin;
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
