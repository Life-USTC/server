import { verifyAccessToken } from "better-auth/oauth2";
import { suspensionForbidden, unauthorized } from "@/lib/api/helpers";
import {
  getJwksUrlForOAuthVerification,
  getOAuthRestAudienceUrls,
  getOAuthTokenVerificationIssuers,
} from "@/lib/mcp/urls";

/**
 * Resolve the authenticated user ID from a request.
 *
 * Checks in order:
 * 1. Bearer token in the `Authorization` header (OAuth access token)
 * 2. Session cookie via Better Auth
 */
export async function resolveApiUserId(
  request: Request,
): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (token) {
      try {
        const jwt = await verifyAccessToken(token, {
          jwksUrl: getJwksUrlForOAuthVerification(),
          verifyOptions: {
            issuer: getOAuthTokenVerificationIssuers(),
            audience: getOAuthRestAudienceUrls(),
          },
        });

        const sub = (jwt as { sub?: unknown }).sub;
        if (typeof sub === "string" && sub.length > 0) {
          return sub;
        }
      } catch {
        // Ignore invalid or opaque bearer tokens here and continue to cookie auth.
      }
    }
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
  const userId = await resolveApiUserId(request);
  if (!userId) return unauthorized();
  const { getViewerAuthDataForUserId } = await import("./viewer-context");
  const data = await getViewerAuthDataForUserId(userId);
  if (!data) return unauthorized();
  if (data.suspension) return suspensionForbidden(data.suspension.reason);
  return { userId };
}
