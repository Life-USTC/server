import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { verifyAccessToken as verifyOAuthAccessToken } from "better-auth/oauth2";
import { isOAuthDebugLogging, logOAuthDebug } from "@/lib/log/oauth-debug";
import { jwtClaimsToAuthInfo } from "@/lib/mcp/jwt-auth-info";
import {
  accessTokenLooksLikeJwt,
  verifyOpaqueAccessTokenForMcp,
} from "@/lib/mcp/opaque-token-verification";
import { type AuthFailure, INVALID_TOKEN_ERROR } from "./auth-errors";
import {
  getJwksUrlForOAuthVerification,
  getOAuthMcpAudienceUrls,
  getOAuthMcpResourceUrl,
  getOAuthTokenVerificationIssuers,
} from "./urls";

export async function verifyAccessToken(
  request: Request,
  token: string,
): Promise<AuthInfo | AuthFailure> {
  const mcpAudience = getOAuthMcpResourceUrl();

  if (accessTokenLooksLikeJwt(token)) {
    try {
      const jwt = await verifyOAuthAccessToken(token, {
        jwksUrl: getJwksUrlForOAuthVerification(),
        verifyOptions: {
          issuer: getOAuthTokenVerificationIssuers(),
          audience: getOAuthMcpAudienceUrls(),
        },
      });
      const jwtClaims = jwt as {
        aud?: unknown;
        azp?: unknown;
        exp?: unknown;
        scope?: unknown;
        sub?: unknown;
      };

      return jwtClaimsToAuthInfo({
        token,
        jwtClaims,
        mcpAudience,
      });
    } catch (err) {
      if (isOAuthDebugLogging()) {
        logOAuthDebug("mcp.jwt-verify-failed", request, {
          name: err instanceof Error ? err.name : "unknown",
          message: err instanceof Error ? err.message : String(err),
        });
      }
      return {
        error: INVALID_TOKEN_ERROR,
        status: 401,
        description: "Access token is invalid",
      };
    }
  }

  const opaque = await verifyOpaqueAccessTokenForMcp(token);
  if (opaque) {
    return opaque;
  }

  if (isOAuthDebugLogging()) {
    logOAuthDebug("mcp.opaque-token-miss", request, {
      reason: "no_matching_hashed_token_scope_or_resource_binding",
    });
  }

  return {
    error: INVALID_TOKEN_ERROR,
    status: 401,
    description: "Access token is invalid",
  };
}
