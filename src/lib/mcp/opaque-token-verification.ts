import { prisma } from "@/lib/db/prisma";
import { MCP_TOOLS_SCOPE } from "@/lib/oauth/constants";
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
  if (!row || row.expiresAt.getTime() <= Date.now()) return null;
  if (!row.scopes.includes(MCP_TOOLS_SCOPE)) return null;
  return {
    error: INVALID_TOKEN_ERROR,
    status: 401,
    description: "Access token is not bound to this MCP resource",
  };
}
