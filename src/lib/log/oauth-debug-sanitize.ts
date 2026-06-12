const SENSITIVE_QUERY_KEYS = new Set([
  "code",
  "access_token",
  "refresh_token",
  "id_token",
  "token",
  "session",
  "session_token",
  "client_secret",
]);

export function summarizeOAuthRedirectUri(
  redirect: string | null,
): Record<string, unknown> {
  if (!redirect) {
    return {
      redirectOrigin: null,
      redirectHost: null,
      redirectHostname: null,
      redirectPort: null,
      redirectPath: null,
      redirectQueryKeys: [],
    };
  }

  try {
    const redirectUrl = new URL(redirect);
    return {
      redirectOrigin: redirectUrl.origin,
      redirectHost: redirectUrl.host,
      redirectHostname: redirectUrl.hostname,
      redirectPort: redirectUrl.port || null,
      redirectPath: redirectUrl.pathname,
      redirectQueryKeys: [...redirectUrl.searchParams.keys()].sort(),
    };
  } catch {
    return {
      redirectOrigin: null,
      redirectHost: "invalid_redirect_uri",
      redirectHostname: null,
      redirectPort: null,
      redirectPath: null,
      redirectQueryKeys: [],
    };
  }
}

export function summarizeOAuthForwardingHeaders(
  request: Request,
  requestUrl?: URL,
): Record<string, unknown> {
  const url = requestUrl ?? new URL(request.url);
  return {
    requestOrigin: url.origin,
    requestHost: url.host,
    hostHeader: request.headers.get("host"),
    forwardedHost: request.headers.get("x-forwarded-host"),
    forwardedProto: request.headers.get("x-forwarded-proto"),
    forwardedPort: request.headers.get("x-forwarded-port"),
    forwardedHeaderPresent: request.headers.has("forwarded"),
  };
}

/** Redact sensitive query parameters in a redirect URL for logs. */
export function sanitizeOAuthRedirectLocation(
  location: string | undefined,
  requestUrl: string,
): string | null {
  if (!location) return null;
  try {
    const u = new URL(location, requestUrl);
    for (const key of [...u.searchParams.keys()]) {
      if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
        u.searchParams.set(key, "[REDACTED]");
      }
    }
    return u.toString();
  } catch {
    return location.length > 240 ? `${location.slice(0, 240)}…` : location;
  }
}

export function summarizeOAuthAuthorizeUrl(
  url: URL,
): Record<string, unknown> | null {
  if (!url.pathname.endsWith("/oauth2/authorize")) return null;
  const sp = url.searchParams;
  const redirect = sp.get("redirect_uri");
  const scope = sp.get("scope");
  return {
    clientIdPrefix: sp.get("client_id")?.slice(0, 16) ?? null,
    ...summarizeOAuthRedirectUri(redirect),
    scopeTokenCount: scope ? scope.split(" ").filter(Boolean).length : 0,
    resource: sp.get("resource"),
    statePresent: Boolean(sp.get("state")),
    codeChallengeMethod: sp.get("code_challenge_method"),
    prompt: sp.get("prompt"),
  };
}
