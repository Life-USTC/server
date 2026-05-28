import { createHash } from "node:crypto";

/**
 * Matches `@better-auth/oauth-provider` default client secret storage when the JWT
 * plugin is enabled: SHA-256 over UTF-8, base64url without padding (`storeClientSecret: "hashed"`).
 */
export function hashOAuthClientSecretForDbStorage(plainSecret: string): string {
  return createHash("sha256").update(plainSecret, "utf8").digest("base64url");
}

export function normalizeResourceIndicator(value: string | URL): string {
  const parsed = new URL(value);

  const protocol = parsed.protocol.toLowerCase();
  const hostname = parsed.hostname.toLowerCase();
  const port =
    parsed.port &&
    !(
      (protocol === "https:" && parsed.port === "443") ||
      (protocol === "http:" && parsed.port === "80")
    )
      ? `:${parsed.port}`
      : "";
  const pathname = parsed.pathname === "/" ? "" : parsed.pathname;

  return `${protocol}//${hostname}${port}${pathname}${parsed.search}`;
}

export function resourceIndicatorsMatch(
  left: string | URL,
  right: string | URL,
): boolean {
  return normalizeResourceIndicator(left) === normalizeResourceIndicator(right);
}
