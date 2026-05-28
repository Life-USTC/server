/**
 * Opt-in OAuth / HTTP tracing for production debugging (dev-server–style visibility).
 *
 * - `OAUTH_DEBUG_LOGGING=1` — log `/api/auth/oauth2/*`, sanitized redirects, authorize summary; log `/api/mcp`.
 * - `OAUTH_DEBUG_LOGGING=verbose` (or `2`) — also log all other `/api/auth/*` routes.
 *
 * Never logs secrets, authorization codes, refresh tokens, access tokens, or cookies.
 */

import { getOptionalTrimmedEnv } from "@/env";
import { OAUTH_TOKEN_ENDPOINT_PATH } from "@/lib/oauth/constants";
import { formatShanghaiTimestamp } from "@/lib/time/shanghai-format";

export type OAuthDebugMode = "off" | "standard" | "verbose";

const OAUTH_DEBUG_DISABLED_VALUES = new Set(["", "0", "false"]);
const OAUTH_DEBUG_VERBOSE_VALUES = new Set(["verbose", "2"]);

export function getOAuthDebugMode(): OAuthDebugMode {
  const value =
    getOptionalTrimmedEnv("OAUTH_DEBUG_LOGGING")?.toLowerCase() ?? "";
  if (OAUTH_DEBUG_DISABLED_VALUES.has(value)) return "off";
  if (OAUTH_DEBUG_VERBOSE_VALUES.has(value)) return "verbose";
  return "standard";
}

export function isOAuthDebugLogging(): boolean {
  return getOAuthDebugMode() !== "off";
}

export function oauthDebugCorrelationId(request: Request): string {
  return (
    request.headers.get("x-request-id") ??
    request.headers.get("cf-ray") ??
    request.headers.get("traceparent")?.slice(0, 55) ??
    "no-correlation-id"
  );
}

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

function summarizeOAuthAuthorizeUrl(url: URL): Record<string, unknown> | null {
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

export function logOAuthDebug(
  event: string,
  request: Request | undefined,
  fields: Record<string, unknown>,
): void {
  if (!isOAuthDebugLogging()) return;

  const payload: Record<string, unknown> = {
    ts: formatShanghaiTimestamp(new Date()),
    event,
    ...fields,
  };

  if (request) {
    payload.correlationId = oauthDebugCorrelationId(request);
  }

  console.info(JSON.stringify(payload));
}

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

  // For token endpoint POSTs, capture request fingerprint to distinguish sources
  let tokenRequestFingerprint: Record<string, unknown> | undefined;
  if (method === "POST" && path === OAUTH_TOKEN_ENDPOINT_PATH) {
    try {
      const cloned = request.clone();
      const fd = await cloned.formData();
      const redirectUri = fd.get("redirect_uri");
      tokenRequestFingerprint = {
        bodyParams: [...fd.keys()].sort(),
        userAgent: request.headers.get("user-agent")?.slice(0, 80) ?? null,
        origin: request.headers.get("origin") ?? null,
        contentType: request.headers.get("content-type") ?? null,
        hasResource: fd.has("resource"),
        resource: fd.get("resource") ?? null,
        hasCodeVerifier: fd.has("code_verifier"),
        grantType: fd.get("grant_type") ?? null,
        debugNonce: request.headers.get("x-debug-nonce") ?? null,
        forwarded: request.headers.get("x-forwarded-for") ?? null,
        via: request.headers.get("via") ?? null,
        ...(typeof redirectUri === "string"
          ? { redirectSummary: summarizeOAuthRedirectUri(redirectUri) }
          : {}),
      };
    } catch {
      // body not form-urlencoded or already consumed
    }
  }

  logOAuthDebug("better-auth.request", request, {
    method,
    path,
    queryKeys: [...url.searchParams.keys()],
    forwardingSummary: summarizeOAuthForwardingHeaders(request, url),
    ...(authorizeSummary ? { authorizeSummary } : {}),
    ...(tokenRequestFingerprint ? { tokenRequestFingerprint } : {}),
  });

  try {
    const res = await run(request);
    const location = res.headers.get("location");
    const redirectTo =
      res.status >= 300 && res.status < 400
        ? sanitizeOAuthRedirectLocation(location ?? undefined, request.url)
        : null;

    // For 4xx/5xx on token endpoint, capture the error body for debugging
    let errorBody: Record<string, unknown> | undefined;
    if (res.status >= 400 && path === OAUTH_TOKEN_ENDPOINT_PATH) {
      try {
        const cloned = res.clone();
        const json = await cloned.json();
        errorBody = {
          error: json.error,
          error_description: json.error_description,
        };
      } catch {
        // body not JSON or already consumed
      }
    }

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
