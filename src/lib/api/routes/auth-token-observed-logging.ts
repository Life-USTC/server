import {
  logOAuthDebug,
  summarizeOAuthForwardingHeaders,
  summarizeOAuthRedirectUri,
} from "@/lib/log/oauth-debug";

export function logObservedTokenRedirectRequest(
  request: Request,
  params: URLSearchParams,
): void {
  const clientId = params.get("client_id");
  const redirectUri = params.get("redirect_uri");
  if (!clientId || !redirectUri) {
    return;
  }

  logOAuthDebug("oauth.token.request-observed", request, {
    path: new URL(request.url).pathname,
    clientIdPrefix: clientId.slice(0, 16),
    grantType: params.get("grant_type"),
    ...summarizeOAuthRedirectUri(redirectUri),
    ...summarizeOAuthForwardingHeaders(request),
  });
}
