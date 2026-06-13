const AUTH_COOKIE_NAME_PATTERN =
  /(?:^|;\s*)(?:__Secure-)?(?:better-auth\.|session(?:Token|_token)?=)/;

export function hasRequestAuthSignal(headers: Headers) {
  if (headers.get("authorization")?.startsWith("Bearer ")) {
    return true;
  }

  return AUTH_COOKIE_NAME_PATTERN.test(headers.get("cookie") ?? "");
}
