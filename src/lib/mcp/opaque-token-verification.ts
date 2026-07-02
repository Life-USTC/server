import { prisma } from "@/lib/db/prisma";
import { hasMcpScope } from "@/lib/oauth/scope-registry";
import { hashOAuthClientSecretForDbStorage } from "@/lib/oauth/utils";
import { type AuthFailure, INVALID_TOKEN_ERROR } from "./auth-errors";

/** Compact JWS: three Base64url segments (OAuth JWT access tokens). */
export function accessTokenLooksLikeJwt(token: string): boolean {
  const parts = token.split(".");
  return (
    parts.length === 3 &&
    parts[0].length > 0 &&
    parts[1].length > 0 &&
    parts[2].length > 0
  );
}

/**
 * When the token request omits `resource`, Better Auth oauth-provider issues an opaque
 * access token (stored hashed). ChatGPT does this; JWT verification then fails because
 * the string is not a JWS.
 */
export async function verifyOpaqueAccessTokenForMcp(
  token: string,
): Promise<AuthFailure | null> {
  if (accessTokenLooksLikeJwt(token)) return null;

  const tokenHash = await hashOAuthClientSecretForDbStorage(token);
  const row = await prisma.oAuthAccessToken.findUnique({
    where: { token: tokenHash },
  });
  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now()) {
    return {
      diagnostics: {
        authFailureKind: "opaque_token_expired",
        authHeaderKind: "bearer",
        authTokenFormat: "opaque",
        scopeCount: row.scopes.length,
      },
      error: INVALID_TOKEN_ERROR,
      status: 401,
      description: "Access token is invalid",
    };
  }
  if (!hasMcpScope(row.scopes)) {
    return {
      diagnostics: {
        authFailureKind: "opaque_token_missing_mcp_scope",
        authHeaderKind: "bearer",
        authTokenFormat: "opaque",
        scopeCount: row.scopes.length,
      },
      error: INVALID_TOKEN_ERROR,
      status: 401,
      description: "Access token is invalid",
    };
  }
  return {
    diagnostics: {
      authFailureKind: "token_resource_unbound",
      authHeaderKind: "bearer",
      authTokenFormat: "opaque",
      scopeCount: row.scopes.length,
      tokenResourceMatchesMcp: false,
      tokenResourcePresent: false,
    },
    error: INVALID_TOKEN_ERROR,
    status: 401,
    description: "Access token is not bound to this MCP resource",
  };
}
