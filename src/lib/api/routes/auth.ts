import { decodeJwt } from "jose";
import {
  type DeviceRegistrationMetadata,
  prepareOAuthClientRegistrationDelegation,
  restoreRegisteredDeviceClientMetadata,
} from "@/features/oauth/server/client-registration-policy.server";
import { bindOAuthAuthorizationCodeRedirectToActiveGrant } from "@/features/oauth/server/oauth-authorization-code-grant.server";
import { verifyOAuthProviderSignedQuery } from "@/features/oauth/server/signed-oauth-query.server";
import {
  revokeUserOAuthAuthorization,
  updateUserOAuthAuthorizationScopes,
} from "@/features/oauth/server/user-authorizations.server";
import { isTrustedAuthOrigin } from "@/lib/auth/auth-origins";
import { verifyAccessTokenJwt } from "@/lib/auth/jwt-verification";
import { prisma } from "@/lib/db/prisma";
import { logAppEvent } from "@/lib/log/app-logger";
import {
  logOAuthDebug,
  summarizeOAuthForwardingHeaders,
  summarizeOAuthRedirectUri,
  withBetterAuthOAuthDebug,
} from "@/lib/log/oauth-debug";
import { getSafeErrorName } from "@/lib/log/safe-error-name";
import {
  getJwksUrlForOAuthVerification,
  getOAuthProviderValidAudiences,
  getOAuthTokenVerificationIssuers,
} from "@/lib/mcp/urls";
import { writeOAuthEventAnalytics } from "@/lib/metrics/analytics-engine";
import {
  hasActiveOAuthUserGrant,
  resolveActiveOAuthUserGrant,
} from "@/lib/oauth/active-user-grant";
import { findDuplicateOAuthFormParameter } from "@/lib/oauth/form-parameters";
import { resolveEquivalentLoopbackRedirectUri } from "@/lib/oauth/loopback-redirect";
import { rewriteOAuthResourceAliases } from "@/lib/oauth/resource-aliases";
import { hashOAuthClientSecretForDbStorage } from "@/lib/oauth/utils";

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
    ioObservedDurationMs: Date.now() - input.startMs,
    method: input.request.method,
    path: url.pathname,
    phase: input.phase,
    status: 500,
  });
}

function isOAuthClientRegistrationRequest(request: Request) {
  return new URL(request.url).pathname.endsWith("/oauth2/register");
}

type OAuthClientRegistrationPreparation =
  | { request: Request; deviceRegistration: DeviceRegistrationMetadata | null }
  | { response: Response };

async function prepareOAuthClientRegistrationRequest(
  request: Request,
): Promise<OAuthClientRegistrationPreparation> {
  if (!isOAuthClientRegistrationRequest(request)) {
    return { request, deviceRegistration: null };
  }

  let body: unknown;
  try {
    body = await request.clone().json();
  } catch {
    return {
      response: Response.json(
        {
          error: "invalid_client_metadata",
          error_description: "Invalid JSON request body",
        },
        { status: 400 },
      ),
    };
  }

  const bodyObject =
    body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!bodyObject) {
    return { request, deviceRegistration: null };
  }

  const prepared = prepareOAuthClientRegistrationDelegation(bodyObject);
  if ("error" in prepared) {
    return {
      response: Response.json(
        {
          error: prepared.error.error,
          error_description: prepared.error.errorDescription,
        },
        { status: 400 },
      ),
    };
  }

  if (!prepared.delegatedBody) {
    return { request, deviceRegistration: null };
  }

  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");

  return {
    request: new Request(request, {
      body: JSON.stringify(prepared.delegatedBody),
      headers,
    }),
    deviceRegistration: prepared.deviceRegistration,
  };
}

async function restoreDeviceRegistrationGrantTypes(
  response: Response,
  registration: DeviceRegistrationMetadata | null,
) {
  if (!registration || !response.ok) {
    return response;
  }

  const body = (await response
    .clone()
    .json()
    .catch(() => null)) as {
    client_id?: unknown;
    grant_types?: unknown;
  } | null;
  if (!body || typeof body.client_id !== "string") {
    return response;
  }

  const restored = await restoreRegisteredDeviceClientMetadata({
    body,
    registration,
  });
  if (!restored) return response;

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return Response.json(
    {
      ...body,
      ...restored,
    },
    {
      status: response.status,
      headers,
    },
  );
}

async function authHandler(request: Request) {
  const { betterAuthInstance } = await import("@/lib/auth/core");
  return betterAuthInstance.handler(request);
}

function isOAuthIntrospectionRequest(request: Request) {
  return new URL(request.url).pathname.endsWith("/oauth2/introspect");
}

function oauthConsentMutationPath(request: Request) {
  const pathname = new URL(request.url).pathname;
  if (pathname === "/api/auth/oauth2/delete-consent") return "delete";
  if (pathname === "/api/auth/oauth2/update-consent") return "update";
  if (pathname === "/api/auth/oauth2/consent") return "provider-consent";
  return null;
}

function consentMutationError(status: number, message: string) {
  const code =
    status === 401
      ? "UNAUTHORIZED"
      : status === 403
        ? "FORBIDDEN"
        : status === 404
          ? "NOT_FOUND"
          : "BAD_REQUEST";
  return Response.json(
    { code, message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

async function handleOAuthConsentMutation(
  request: Request,
  mutation: "delete" | "provider-consent" | "update",
) {
  if (mutation === "provider-consent") {
    return consentMutationError(
      404,
      "OAuth consent is only available through the authorization page",
    );
  }

  const origin =
    request.headers.get("origin") ?? request.headers.get("referer");
  if (!origin || origin === "null" || !isTrustedAuthOrigin(origin)) {
    return consentMutationError(403, "Invalid origin");
  }

  const { getSessionFromHeaders } = await import("@/lib/auth/core");
  const session = await getSessionFromHeaders(request.headers);
  if (!session?.user.id) {
    return consentMutationError(401, "Authentication required");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return consentMutationError(400, "Invalid JSON request body");
  }
  const input =
    body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const consentId = typeof input?.id === "string" ? input.id : "";
  if (!consentId) return consentMutationError(400, "Missing consent id");

  if (mutation === "delete") {
    const result = await revokeUserOAuthAuthorization(
      session.user.id,
      consentId,
    );
    return result.ok
      ? Response.json(null, { headers: { "Cache-Control": "no-store" } })
      : consentMutationError(404, "OAuth authorization not found");
  }

  const update =
    input?.update && typeof input.update === "object"
      ? (input.update as Record<string, unknown>)
      : null;
  if (
    !Array.isArray(update?.scopes) ||
    !update.scopes.every((scope) => typeof scope === "string")
  ) {
    return consentMutationError(400, "Invalid OAuth scopes");
  }
  const result = await updateUserOAuthAuthorizationScopes(
    session.user.id,
    consentId,
    update.scopes,
  );
  if (!result.ok) {
    return consentMutationError(
      result.reason === "not_found" ? 404 : 400,
      result.reason === "not_found"
        ? "OAuth authorization not found"
        : "Invalid OAuth scopes",
    );
  }
  return Response.json(
    { id: result.consentId, scopes: result.scopes },
    { headers: { "Cache-Control": "no-store" } },
  );
}

const INTROSPECTION_SINGLETON_FORM_PARAMETERS = [
  "token",
  "token_type_hint",
  "client_id",
  "client_secret",
] as const;

async function prepareIntrospectionParams(
  request: Request,
): Promise<{ params: URLSearchParams } | { response: Response }> {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(await request.clone().text());
  } catch {
    return {
      response: Response.json(
        {
          error: "invalid_request",
          error_description: "Invalid introspection request body",
        },
        { status: 400 },
      ),
    };
  }
  const duplicate = findDuplicateOAuthFormParameter(
    params,
    INTROSPECTION_SINGLETON_FORM_PARAMETERS,
  );
  if (duplicate) {
    return {
      response: Response.json(
        {
          error: "invalid_request",
          error_description: `OAuth parameter "${duplicate}" must not be repeated`,
        },
        { status: 400 },
      ),
    };
  }
  return { params };
}

async function getLocalJwks() {
  const { authApi } = await import("@/lib/auth/core");
  return authApi.getJwks({});
}

function inactiveIntrospectionResponse(response: Response) {
  const headers = new Headers(response.headers);
  headers.delete("Content-Length");
  headers.set("Content-Type", "application/json; charset=utf-8");
  return Response.json(
    { active: false },
    { headers, status: response.status, statusText: response.statusText },
  );
}

async function resolveOpaqueIntrospectionGrant(
  token: string,
  tokenTypeHint: string | null,
) {
  const tokenHash = await hashOAuthClientSecretForDbStorage(
    token.replace(/^Bearer /, ""),
  );
  if (!tokenTypeHint || tokenTypeHint === "access_token") {
    const accessToken = await prisma.oAuthAccessToken.findUnique({
      where: { token: tokenHash },
      select: {
        clientId: true,
        grantId: true,
        referenceId: true,
        scopes: true,
        userId: true,
      },
    });
    if (accessToken) {
      return accessToken.userId
        ? {
            clientId: accessToken.clientId,
            grantId:
              accessToken.grantId ?? accessToken.referenceId ?? undefined,
            scopes: accessToken.scopes,
            userId: accessToken.userId,
          }
        : { machine: true as const };
    }
  }
  if (!tokenTypeHint || tokenTypeHint === "refresh_token") {
    const refreshToken = await prisma.oAuthRefreshToken.findUnique({
      where: { token: tokenHash },
      select: {
        clientId: true,
        grantId: true,
        referenceId: true,
        scopes: true,
        userId: true,
      },
    });
    if (refreshToken) {
      return {
        clientId: refreshToken.clientId,
        grantId: refreshToken.grantId ?? refreshToken.referenceId ?? undefined,
        scopes: refreshToken.scopes,
        userId: refreshToken.userId,
      };
    }
  }
  return null;
}

async function enforceIntrospectionGrant(
  request: Request,
  params: URLSearchParams,
  response: Response,
) {
  if (!response.ok) return response;
  const responseBody = (await response
    .clone()
    .json()
    .catch(() => null)) as { active?: unknown } | null;
  if (responseBody?.active !== true) return response;

  const token = params.get("token");
  if (!token) return inactiveIntrospectionResponse(response);
  const startMs = Date.now();

  try {
    if (token.split(".").length === 3) {
      if (typeof decodeJwt(token).sub !== "string") return response;
      const verified = await verifyAccessTokenJwt(token, {
        audience: getOAuthProviderValidAudiences(),
        issuer: getOAuthTokenVerificationIssuers(),
        jwksFetch: getLocalJwks,
        jwksUrl: getJwksUrlForOAuthVerification(),
      });
      if (
        verified.clientId &&
        (await hasActiveOAuthUserGrant({
          clientId: verified.clientId,
          grantId: verified.grantId,
          requireGrantBinding: true,
          scopes: verified.tokenScopes,
          userId: verified.sub,
        }))
      ) {
        return response;
      }
      return inactiveIntrospectionResponse(response);
    }

    const grant = await resolveOpaqueIntrospectionGrant(
      token,
      params.get("token_type_hint"),
    );
    if (grant && "machine" in grant) return response;
    if (
      grant &&
      (await hasActiveOAuthUserGrant({
        clientId: grant.clientId,
        grantId: grant.grantId,
        requireGrantBinding: true,
        scopes: grant.scopes,
        userId: grant.userId,
      }))
    ) {
      return response;
    }
  } catch (error) {
    // Introspection must fail closed when the grant cannot be verified.
    recordOAuthRouteFailure({
      error,
      event: "oauth.introspection.grant-verification-failed",
      phase: "grant-verification",
      request,
      startMs,
    });
  }

  return inactiveIntrospectionResponse(response);
}

async function maybeNormalizeAuthorizeLoopbackRedirectRequest(
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

  const client = await prisma.oAuthClient.findUnique({
    where: { clientId },
    select: { redirectUris: true },
  });
  if (!client) {
    return request;
  }

  const normalizedRedirectUri = resolveEquivalentLoopbackRedirectUri(
    client.redirectUris,
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

function maybeNormalizeAuthorizeResourceRequest(request: Request): Request {
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

async function enforceAuthorizationCodeGrantBinding(
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

async function resolveAuthorizationCodeGrantExpectation(request: Request) {
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
      startMs: consentUpdatedBefore.getTime(),
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
  const startMs = Date.now();
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

export const authGetRoute = async (request: Request) => {
  const normalizedRequest =
    await maybeNormalizeAuthorizeLoopbackRedirectRequest(
      maybeNormalizeAuthorizeResourceRequest(request),
    );
  const expectation =
    await resolveAuthorizationCodeGrantExpectation(normalizedRequest);
  const response = await withBetterAuthOAuthDebug(
    "GET",
    normalizedRequest,
    authHandler,
  );
  return enforceAuthorizationCodeGrantBinding(
    normalizedRequest,
    response,
    expectation,
  );
};

export const authPostRoute = async (request: Request) => {
  const consentMutation = oauthConsentMutationPath(request);
  if (consentMutation) {
    return handleOAuthConsentMutation(request, consentMutation);
  }
  const introspection = isOAuthIntrospectionRequest(request)
    ? await prepareIntrospectionParams(request)
    : null;
  if (introspection && "response" in introspection) {
    return introspection.response;
  }
  const prepared = await prepareOAuthClientRegistrationRequest(request);
  if ("response" in prepared) return prepared.response;
  const expectation = await resolveAuthorizationCodeGrantExpectation(
    prepared.request,
  );
  const response = await withBetterAuthOAuthDebug(
    "POST",
    prepared.request,
    authHandler,
  );
  const restored = await restoreDeviceRegistrationGrantTypes(
    response,
    prepared.deviceRegistration,
  );
  const finalized =
    introspection && "params" in introspection
      ? enforceIntrospectionGrant(
          prepared.request,
          introspection.params,
          restored,
        )
      : restored;
  return enforceAuthorizationCodeGrantBinding(
    prepared.request,
    await finalized,
    expectation,
  );
};

export const authPatchRoute = (request: Request) =>
  withBetterAuthOAuthDebug("PATCH", request, authHandler);

export const authPutRoute = (request: Request) =>
  withBetterAuthOAuthDebug("PUT", request, authHandler);

export const authDeleteRoute = (request: Request) =>
  withBetterAuthOAuthDebug("DELETE", request, authHandler);
