import { verifyAccessToken } from "better-auth/oauth2";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { suspensionForbidden, unauthorized } from "@/lib/api/helpers";
import { buildSignInRedirectUrl } from "@/lib/auth/auth-routing";
import {
  getJwksUrlForOAuthVerification,
  getOAuthRestAudienceUrls,
  getOAuthTokenVerificationIssuers,
} from "@/lib/mcp/urls";
import { getViewerAuthDataForUserId } from "./viewer-context";

export async function requireSignedInUserId(callbackUrl = "/") {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect(buildSignInRedirectUrl({}, callbackUrl));
  }

  return userId;
}

/**
 * Resolve the authenticated user ID from a request.
 *
 * Checks in order:
 * 1. Bearer token in the `Authorization` header (OAuth access token)
 * 2. Session cookie via Better Auth
 *
 * Returns `null` when no valid credential is found.
 */
export async function resolveApiUserId(
  request: Request,
): Promise<string | null> {
  // 1. Try Bearer token (OAuth access token)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (token) {
      try {
        const jwt = await verifyAccessToken(token, {
          jwksUrl: getJwksUrlForOAuthVerification(),
          // General protected REST endpoints only accept issuer-bound JWT access
          // tokens. Opaque/no-resource tokens are reserved for the MCP transport,
          // where resource and scope checks happen in src/lib/mcp/auth.ts.
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
        // Ignore invalid or opaque bearer tokens here and continue to the
        // session-cookie fallback below.
      }
    }
  }

  // 2. Fall back to the session cookie on this route request.
  const session = await auth(request.headers);
  return session?.user?.id ?? null;
}

/**
 * Require an authenticated user ID from a request.
 *
 * Returns `{ userId }` on success, or a 401 Response on failure.
 * Use this for routes that need auth but don't need suspension checks.
 *
 *   const auth = await requireAuth(request);
 *   if (auth instanceof Response) return auth;
 *   const { userId } = auth;
 */
export async function requireAuth(
  request: Request,
): Promise<{ userId: string } | Response> {
  const userId = await resolveApiUserId(request);
  return userId ? { userId } : unauthorized();
}

/**
 * Check auth + suspension for collaborative write routes.
 *
 * Returns `{ userId }` on success, or a Response (401/403) on failure.
 * Usage:
 *   const auth = await requireWriteAuth(request);
 *   if (auth instanceof Response) return auth;
 *   const { userId } = auth;
 */
export async function requireWriteAuth(
  request: Request,
): Promise<{ userId: string } | Response> {
  const userId = await resolveApiUserId(request);
  if (!userId) return unauthorized();
  const data = await getViewerAuthDataForUserId(userId);
  if (!data) return unauthorized();
  if (data.suspension) return suspensionForbidden(data.suspension.reason);
  return { userId };
}
