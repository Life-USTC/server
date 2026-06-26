const BEARER_AUTHORIZATION_PATTERN = /^Bearer(?:\s+(.*))?$/i;

export type BearerAuthorization = {
  token: string | null;
};

export function parseBearerAuthorizationHeader(
  headers: Headers,
): BearerAuthorization | null {
  const value = headers.get("authorization")?.trimStart();
  if (!value) return null;

  const match = BEARER_AUTHORIZATION_PATTERN.exec(value);
  if (!match) return null;

  const token = match[1]?.trim() ?? "";
  return { token: token.length > 0 ? token : null };
}

export function hasBearerAuthorizationHeader(headers: Headers) {
  return parseBearerAuthorizationHeader(headers) !== null;
}
