import { hasBearerAuthorizationHeader } from "./authorization-header";

const AUTH_COOKIE_NAME_PATTERN =
  /(?:^|;\s*)(?:__Secure-)?(?:better-auth\.|session(?:Token|_token)?=)/;

export function hasRequestAuthSignal(headers: Headers) {
  if (hasBearerAuthorizationHeader(headers)) {
    return true;
  }

  return AUTH_COOKIE_NAME_PATTERN.test(headers.get("cookie") ?? "");
}
