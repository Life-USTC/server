import { suspensionForbidden, unauthorized } from "@/lib/api/helpers";
import {
  getJwksUrlForOAuthVerification,
  getOAuthRestAudienceUrls,
  getOAuthTokenVerificationIssuers,
} from "@/lib/mcp/urls";
import {
  type RestFeature,
  restReadScope,
  restWriteScope,
} from "@/lib/oauth/constants";
import { isFeatureScope } from "@/lib/oauth/scope-registry";
import { parseBearerAuthorizationHeader } from "./authorization-header";
import { verifyAccessTokenJwt } from "./jwt-verification";
import { hasRequestAuthSignal } from "./request-auth-signal";

export type RestBearerScopeRequirement = {
  feature: RestFeature;
  action: "read" | "write";
};

function hasRequiredRestScope(
  scopes: Set<string>,
  requirement: RestBearerScopeRequirement,
): boolean {
  const { feature, action } = requirement;
  if (action === "write") {
    return scopes.has(restWriteScope(feature));
  }
  return (
    scopes.has(restReadScope(feature)) || scopes.has(restWriteScope(feature))
  );
}

function hasAnyRestScope(scopes: Set<string>): boolean {
  return [...scopes].some(isFeatureScope);
}

async function getLocalJwks() {
  const { authApi } = await import("@/lib/auth/core");
  return authApi.getJwks({});
}

/**
 * Resolve the authenticated user ID from a request.
 *
 * Checks in order:
 * 1. Bearer token in the `Authorization` header (OAuth access token)
 * 2. Session cookie via Better Auth
 */
export async function resolveApiUserId(
  request: Request,
  options: { bearerScope?: RestBearerScopeRequirement } = {},
): Promise<string | null> {
  const bearer = parseBearerAuthorizationHeader(request.headers);
  if (bearer) {
    const token = bearer.token ?? "";
    if (!token) return null;
    try {
      const verified = await verifyAccessTokenJwt(token, {
        jwksFetch: getLocalJwks,
        jwksUrl: getJwksUrlForOAuthVerification(),
        issuer: getOAuthTokenVerificationIssuers(),
        audience: getOAuthRestAudienceUrls(),
      });

      const requirement = options.bearerScope;
      if (requirement) {
        if (!hasRequiredRestScope(verified.scope, requirement)) return null;
      } else {
        if (!hasAnyRestScope(verified.scope)) return null;
      }
      return verified.sub;
    } catch {
      return null;
    }
  }

  if (!hasRequestAuthSignal(request.headers)) return null;

  const { getSessionFromHeaders } = await import("@/lib/auth/core");
  const session = await getSessionFromHeaders(request.headers);
  return session?.user?.id ?? null;
}

export async function resolveSessionUserId(
  request: Request,
): Promise<string | null> {
  if (parseBearerAuthorizationHeader(request.headers)) {
    return null;
  }
  if (!hasRequestAuthSignal(request.headers)) return null;

  const { getSessionFromHeaders } = await import("@/lib/auth/core");
  const session = await getSessionFromHeaders(request.headers);
  return session?.user?.id ?? null;
}

export async function requireAuth(
  request: Request,
  options: { bearerScope?: RestBearerScopeRequirement } = {},
): Promise<{ userId: string } | Response> {
  const userId = await resolveApiUserId(request, options);
  return userId ? { userId } : unauthorized();
}

/**
 * Require write access for a REST feature.
 *
 * Currently all callers are upload routes, so it defaults to the upload
 * feature. Callers may override the feature when needed.
 */
export async function requireWriteAuth(
  request: Request,
  feature: RestFeature = "upload",
): Promise<{ userId: string } | Response> {
  const userId = await resolveApiUserId(request, {
    bearerScope: { feature, action: "write" },
  });
  if (!userId) return unauthorized();
  const { getViewerAuthDataForUserId } = await import("./viewer-context");
  const data = await getViewerAuthDataForUserId(userId);
  if (!data) return unauthorized();
  if (data.suspension) return suspensionForbidden(data.suspension.reason);
  return { userId };
}
