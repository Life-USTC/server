import { decodeJwt } from "jose";
import { resolveOpaqueIntrospectionGrant } from "@/features/oauth/server/oauth-introspection-grant.server";
import { verifyAccessTokenJwt } from "@/lib/auth/jwt-verification";
import { logAppEvent } from "@/lib/log/app-logger";
import { elapsedMs, monotonicNowMs } from "@/lib/log/observability-clock";
import { getSafeErrorName } from "@/lib/log/safe-error-name";
import {
  getJwksUrlForOAuthVerification,
  getOAuthProviderValidAudiences,
  getOAuthTokenVerificationIssuers,
} from "@/lib/mcp/urls";
import { writeOAuthEventAnalytics } from "@/lib/metrics/analytics-engine";
import { hasActiveOAuthUserGrant } from "@/lib/oauth/active-user-grant";
import { findDuplicateOAuthFormParameter } from "@/lib/oauth/form-parameters";

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

export function isOAuthIntrospectionRequest(request: Request) {
  return new URL(request.url).pathname.endsWith("/oauth2/introspect");
}

const INTROSPECTION_SINGLETON_FORM_PARAMETERS = [
  "token",
  "token_type_hint",
  "client_id",
  "client_secret",
] as const;

export async function prepareIntrospectionParams(
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

export async function enforceIntrospectionGrant(
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
  const startMs = monotonicNowMs();

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
