import { verifyAccessToken } from "better-auth/oauth2";
import { suspensionForbidden, unauthorized } from "@/lib/api/helpers";
import {
  getJwksUrlForOAuthVerification,
  getOAuthRestAudienceUrls,
  getOAuthTokenVerificationIssuers,
} from "@/lib/mcp/urls";
import {
  OAUTH_REST_READ_SCOPE,
  OAUTH_REST_WRITE_SCOPE,
} from "@/lib/oauth/constants";

type RestBearerScopeRequirement = "read" | "write";

function parseScopeClaim(scope: unknown): Set<string> {
  if (typeof scope === "string") {
    return new Set(scope.split(/\s+/).filter(Boolean));
  }
  if (Array.isArray(scope)) {
    return new Set(scope.filter((value) => typeof value === "string"));
  }
  return new Set();
}

function hasRequiredRestScope(
  scope: unknown,
  requirement: RestBearerScopeRequirement,
) {
  const scopes = parseScopeClaim(scope);
  if (requirement === "write") {
    return scopes.has(OAUTH_REST_WRITE_SCOPE);
  }
  return (
    scopes.has(OAUTH_REST_READ_SCOPE) || scopes.has(OAUTH_REST_WRITE_SCOPE)
  );
}

function resolveBearerScopeRequirement(
  request: Request,
  explicitRequirement?: RestBearerScopeRequirement,
): RestBearerScopeRequirement {
  if (explicitRequirement) return explicitRequirement;
  return ["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())
    ? "read"
    : "write";
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
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.match(/^Bearer(?:\s+(.+))?$/);
  if (bearer) {
    const token = bearer[1]?.trim() ?? "";
    if (!token) return null;
    try {
      const jwt = await verifyAccessToken(token, {
        jwksUrl: getJwksUrlForOAuthVerification(),
        verifyOptions: {
          issuer: getOAuthTokenVerificationIssuers(),
          audience: getOAuthRestAudienceUrls(),
        },
      });

      const sub = (jwt as { sub?: unknown }).sub;
      const scope = (jwt as { scope?: unknown }).scope;
      if (
        typeof sub === "string" &&
        sub.length > 0 &&
        hasRequiredRestScope(
          scope,
          resolveBearerScopeRequirement(request, options.bearerScope),
        )
      ) {
        return sub;
      }
    } catch {
      return null;
    }

    return null;
  }

  const { getSessionFromHeaders } = await import("@/lib/auth/core");
  const session = await getSessionFromHeaders(request.headers);
  return session?.user?.id ?? null;
}

export async function resolveSessionUserId(
  request: Request,
): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (/^Bearer(?:\s|$)/i.test(authHeader?.trimStart() ?? "")) {
    return null;
  }

  const { getSessionFromHeaders } = await import("@/lib/auth/core");
  const session = await getSessionFromHeaders(request.headers);
  return session?.user?.id ?? null;
}

export async function requireAuth(
  request: Request,
): Promise<{ userId: string } | Response> {
  const userId = await resolveApiUserId(request);
  return userId ? { userId } : unauthorized();
}

export async function requireWriteAuth(
  request: Request,
): Promise<{ userId: string } | Response> {
  const userId = await resolveApiUserId(request, { bearerScope: "write" });
  if (!userId) return unauthorized();
  const { getViewerAuthDataForUserId } = await import("./viewer-context");
  const data = await getViewerAuthDataForUserId(userId);
  if (!data) return unauthorized();
  if (data.suspension) return suspensionForbidden(data.suspension.reason);
  return { userId };
}
