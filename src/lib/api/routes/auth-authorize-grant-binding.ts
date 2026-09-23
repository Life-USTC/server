import { bindOAuthAuthorizationCodeRedirectToActiveGrant } from "@/features/oauth/server/oauth-authorization-code-grant.server";
import { getOAuthClientRedirectUris } from "@/features/oauth/server/oauth-client-redirect-uris.server";
import { verifyOAuthProviderSignedQuery } from "@/features/oauth/server/signed-oauth-query.server";
import { logAppEvent } from "@/lib/log/app-logger";
import {
  logOAuthDebug,
  summarizeOAuthForwardingHeaders,
  summarizeOAuthRedirectUri,
} from "@/lib/log/oauth-debug";
import { elapsedMs, monotonicNowMs } from "@/lib/log/observability-clock";
import { getSafeErrorName } from "@/lib/log/safe-error-name";
import { writeOAuthEventAnalytics } from "@/lib/metrics/analytics-engine";
import { resolveActiveOAuthUserGrant } from "@/lib/oauth/active-user-grant";
import { resolveEquivalentLoopbackRedirectUri } from "@/lib/oauth/loopback-redirect";
import { rewriteOAuthResourceAliases } from "@/lib/oauth/resource-aliases";

function recordOAuthRouteFailure(input: {
  error: unknown;
  event: string;
  phase: string;
  request: Request;
  startMs: number;
}) {
  const url = new URL(input.request.url);
  logAppEvent(
    "error",
    input.event,
    {
      event: input.event,
      method: input.request.method,
      phase: input.phase,
      source: "oauth",
    },
    input.error,
  );
  writeOAuthEventAnalytics({
    errorName: getSafeErrorName(input.error),
    event: input.event,
    ioObservedDurationMs: elapsedMs(input.startMs),
    method: input.request.method,
    path: url.pathname,
    phase: input.phase,
    status: 500,
  });
}

export async function maybeNormalizeAuthorizeLoopbackRedirectRequest(
  request: Request,
): Promise<Request> {
  const url = new URL(request.url);
  if (!url.pathname.endsWith("/oauth2/authorize")) {
    return request;
  }

  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  if (!clientId || !redirectUri) {
    return request;
  }

  logOAuthDebug("oauth.authorize.request-observed", request, {
    path: url.pathname,
    clientIdPrefix: clientId.slice(0, 16),
    ...summarizeOAuthRedirectUri(redirectUri),
    ...summarizeOAuthForwardingHeaders(request, url),
  });

  const redirectUris = await getOAuthClientRedirectUris(clientId);
  if (!redirectUris) {
    return request;
  }

  const normalizedRedirectUri = resolveEquivalentLoopbackRedirectUri(
    redirectUris,
    redirectUri,
  );
  if (!normalizedRedirectUri || normalizedRedirectUri === redirectUri) {
    return request;
  }

  url.searchParams.set("redirect_uri", normalizedRedirectUri);
  logOAuthDebug("oauth.loopback-redirect-normalized", request, {
    path: url.pathname,
    clientIdPrefix: clientId.slice(0, 16),
    fromRedirect: summarizeOAuthRedirectUri(redirectUri),
    toRedirect: summarizeOAuthRedirectUri(normalizedRedirectUri),
  });
  return new Request(url, request);
}

export function maybeNormalizeAuthorizeResourceRequest(
  request: Request,
): Request {
  const url = new URL(request.url);
  if (!url.pathname.endsWith("/oauth2/authorize")) {
    return request;
  }

  const params = new URLSearchParams(url.searchParams);
  if (!rewriteOAuthResourceAliases(params)) {
    return request;
  }

  url.search = params.toString();
  logOAuthDebug("oauth.resource-alias-normalized", request, {
    path: url.pathname,
  });
  return new Request(url, request);
}

export async function enforceAuthorizationCodeGrantBinding(
  request: Request,
  response: Response,
  expectation?: {
    clientId: string | null;
    consentUpdatedBefore: Date;
    grantId?: string;
  },
) {
  const pathname = new URL(request.url).pathname;
  const isAuthorize = pathname.endsWith("/oauth2/authorize");
  const isContinue = pathname.endsWith("/oauth2/continue");
  if (!isAuthorize && !isContinue && !expectation) {
    return response;
  }

  const location = response.headers.get("location");
  if (location) {
    return enforceAuthorizationCodeRedirectBinding({
      expectedClientId: expectation
        ? expectation.clientId
        : isAuthorize
          ? getSingleAuthorizationClientId(request)
          : undefined,
      expectedGrantId: expectation?.grantId,
      consentUpdatedBefore: expectation?.consentUpdatedBefore,
      location,
      request,
      response,
    });
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;
  const body = (await response
    .clone()
    .json()
    .catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.url !== "string") return response;

  const bound = await enforceAuthorizationCodeRedirectBinding({
    expectedClientId: expectation
      ? expectation.clientId
      : isAuthorize
        ? getSingleAuthorizationClientId(request)
        : undefined,
    expectedGrantId: expectation?.grantId,
    consentUpdatedBefore: expectation?.consentUpdatedBefore,
    location: body.url,
    request,
    response,
  });
  const rewrittenLocation = bound.headers.get("location");
  if (!rewrittenLocation) return response;

  const headers = new Headers(bound.headers);
  headers.delete("Content-Length");
  headers.delete("location");
  return Response.json(
    { ...body, url: rewrittenLocation },
    {
      headers,
      status: bound.status,
      statusText: bound.statusText,
    },
  );
}

function getSingleAuthorizationClientId(request: Request) {
  const clientIds = new URL(request.url).searchParams.getAll("client_id");
  return clientIds.length === 1 && clientIds[0] ? clientIds[0] : null;
}

export async function resolveAuthorizationCodeGrantExpectation(
  request: Request,
) {
  const startMs = monotonicNowMs();
  const consentUpdatedBefore = new Date();
  const url = new URL(request.url);
  const isAuthorize = url.pathname.endsWith("/oauth2/authorize");
  let query = url.searchParams;
  if (!isAuthorize) {
    const oauthQuery = await getSignedOAuthQueryFromRequest(request);
    if (!oauthQuery) {
      return url.pathname.endsWith("/oauth2/continue")
        ? { clientId: null, consentUpdatedBefore }
        : undefined;
    }
    const verifiedQuery = await verifyOAuthProviderSignedQuery(oauthQuery);
    if (!verifiedQuery) return { clientId: null, consentUpdatedBefore };
    query = verifiedQuery;
  }

  const clientIds = query.getAll("client_id");
  const clientId = clientIds.length === 1 && clientIds[0] ? clientIds[0] : null;
  if (!clientId) return { clientId: null, consentUpdatedBefore };

  try {
    const { getSessionFromHeaders } = await import("@/lib/auth/core");
    const session = await getSessionFromHeaders(request.headers);
    const userId = session?.user.id;
    if (!userId) return { clientId, consentUpdatedBefore };

    const scopeValues = query.getAll("scope");
    const scopes =
      scopeValues.length === 1
        ? [...new Set(scopeValues[0].split(/\s+/).filter(Boolean))]
        : [];
    const grant = await resolveActiveOAuthUserGrant({
      clientId,
      scopes,
      userId,
    });
    return {
      clientId,
      consentUpdatedBefore,
      ...(grant?.kind === "consent" ? { grantId: grant.grantId } : {}),
    };
  } catch (error) {
    recordOAuthRouteFailure({
      error,
      event: "oauth.authorization.grant-expectation-failed",
      phase: "grant-expectation",
      request,
      startMs,
    });
    return { clientId, consentUpdatedBefore };
  }
}

async function getSignedOAuthQueryFromRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const body = (await request.clone().json()) as {
        oauth_query?: unknown;
      };
      return typeof body?.oauth_query === "string"
        ? body.oauth_query
        : undefined;
    }
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const body = new URLSearchParams(await request.clone().text());
      const values = body.getAll("oauth_query");
      return values.length === 1 && values[0] ? values[0] : undefined;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

async function enforceAuthorizationCodeRedirectBinding(input: {
  expectedClientId: string | null | undefined;
  consentUpdatedBefore?: Date;
  expectedGrantId?: string;
  location: string;
  request: Request;
  response: Response;
}) {
  let target: URL;
  try {
    target = new URL(input.location, input.request.url);
  } catch {
    return input.response;
  }
  if (!target.searchParams.has("code")) return input.response;

  let bound = false;
  let bindingError: unknown;
  const startMs = monotonicNowMs();
  try {
    bound =
      input.expectedClientId !== null &&
      (await bindOAuthAuthorizationCodeRedirectToActiveGrant(
        input.location,
        input.expectedClientId,
        input.request.url,
        input.expectedGrantId,
        input.consentUpdatedBefore,
      ));
  } catch (error) {
    bindingError = error;
    bound = false;
  }
  if (bound) return input.response;
  if (bindingError) {
    recordOAuthRouteFailure({
      error: bindingError,
      event: "oauth.authorization.code-binding-failed",
      phase: "code-binding",
      request: input.request,
      startMs,
    });
  } else {
    logAppEvent("warn", "oauth.authorization.code-binding-rejected", {
      event: "oauth.authorization.code-binding-rejected",
      method: input.request.method,
      phase: "code-binding",
      source: "oauth",
    });
  }

  target.searchParams.delete("code");
  target.searchParams.set("error", "server_error");
  target.searchParams.set(
    "error_description",
    "OAuth authorization could not be grant-bound",
  );
  const headers = new Headers(input.response.headers);
  headers.delete("Content-Length");
  headers.set("Cache-Control", "no-store");
  headers.set("location", target.toString());
  return new Response(null, {
    headers,
    status: input.response.status,
    statusText: input.response.statusText,
  });
}
