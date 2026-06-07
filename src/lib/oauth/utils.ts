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

function getNormalizedResourceParts(value: string | URL) {
  const parsed = new URL(normalizeResourceIndicator(value));
  return {
    protocol: parsed.protocol,
    hostname: parsed.hostname,
    port: parsed.port,
    pathname: parsed.pathname,
    search: parsed.search,
  };
}

function areLocalLoopbackHostnames(left: string, right: string) {
  return (
    (left === "localhost" && right === "127.0.0.1") ||
    (left === "127.0.0.1" && right === "localhost")
  );
}

export function resourceIndicatorsMatch(
  left: string | URL,
  right: string | URL,
): boolean {
  const normalizedLeft = normalizeResourceIndicator(left);
  const normalizedRight = normalizeResourceIndicator(right);
  if (normalizedLeft === normalizedRight) {
    return true;
  }

  const leftParts = getNormalizedResourceParts(normalizedLeft);
  const rightParts = getNormalizedResourceParts(normalizedRight);
  return (
    areLocalLoopbackHostnames(leftParts.hostname, rightParts.hostname) &&
    leftParts.protocol === rightParts.protocol &&
    leftParts.port === rightParts.port &&
    leftParts.pathname === rightParts.pathname &&
    leftParts.search === rightParts.search
  );
}
