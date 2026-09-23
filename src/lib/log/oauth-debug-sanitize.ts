export function summarizeOAuthRedirectUri(
  redirect: string | null,
  base?: string,
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
    const redirectUrl = new URL(redirect, base);
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

/** Summarize a redirect URL without retaining any query values. */
export function summarizeOAuthRedirectLocation(
  location: string | undefined,
  requestUrl: string,
): Record<string, unknown> | null {
  if (!location) return null;
  return summarizeOAuthRedirectUri(location, requestUrl);
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
    resourcePresent: sp.has("resource"),
    statePresent: Boolean(sp.get("state")),
    codeChallengeMethod: sp.get("code_challenge_method"),
    prompt: sp.get("prompt"),
  };
}
