import { OAUTH_TOKEN_ENDPOINT_PATH } from "@/lib/oauth/constants";
import {
  getOAuthDebugMode,
  logOAuthDebug,
  type OAuthDebugMode,
  oauthDebugCorrelationId,
} from "./oauth-debug-mode";
import {
  sanitizeOAuthRedirectLocation,
  summarizeOAuthAuthorizeUrl,
  summarizeOAuthForwardingHeaders,
} from "./oauth-debug-sanitize";
import { tokenErrorBody, tokenRequestFingerprint } from "./oauth-debug-token";

function shouldLogBetterAuthPath(
  pathname: string,
  mode: Exclude<OAuthDebugMode, "off">,
): boolean {
  if (!pathname.startsWith("/api/auth")) return false;
  if (mode === "verbose") return true;
  return pathname.includes("/oauth2");
}

/**
 * Wrap Better Auth App Router handlers to log oauth2 (or all /api/auth in verbose mode).
 */
export async function withBetterAuthOAuthDebug(
  method: string,
  request: Request,
  run: (req: Request) => Promise<Response>,
): Promise<Response> {
  const debugMode = getOAuthDebugMode();
  if (debugMode === "off") {
    return run(request);
  }

  const url = new URL(request.url);
  const path = url.pathname;

  if (!shouldLogBetterAuthPath(path, debugMode)) {
    return run(request);
  }

  const correlationId = oauthDebugCorrelationId(request);
  const start = Date.now();
  const authorizeSummary =
    method === "GET" ? summarizeOAuthAuthorizeUrl(url) : null;
  const tokenFingerprint =
    method === "POST" && path === OAUTH_TOKEN_ENDPOINT_PATH
      ? await tokenRequestFingerprint(request)
      : undefined;

  logOAuthDebug("better-auth.request", request, {
    method,
    path,
    queryKeys: [...url.searchParams.keys()],
    forwardingSummary: summarizeOAuthForwardingHeaders(request, url),
    ...(authorizeSummary ? { authorizeSummary } : {}),
    ...(tokenFingerprint ? { tokenRequestFingerprint: tokenFingerprint } : {}),
  });

  try {
    const res = await run(request);
    const location = res.headers.get("location");
    const redirectTo =
      res.status >= 300 && res.status < 400
        ? sanitizeOAuthRedirectLocation(location ?? undefined, request.url)
        : null;
    const errorBody =
      res.status >= 400 && path === OAUTH_TOKEN_ENDPOINT_PATH
        ? await tokenErrorBody(res)
        : undefined;

    logOAuthDebug("better-auth.response", undefined, {
      correlationId,
      method,
      path,
      status: res.status,
      ms: Date.now() - start,
      ...(redirectTo ? { redirectTo } : {}),
      ...(location && !redirectTo ? { locationPresent: true } : {}),
      ...(errorBody ? { errorBody } : {}),
    });
    return res;
  } catch (err) {
    logOAuthDebug("better-auth.error", undefined, {
      correlationId,
      method,
      path,
      ms: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
