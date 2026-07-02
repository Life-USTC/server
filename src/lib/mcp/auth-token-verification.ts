import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { verifyJwsAccessToken as verifyOAuthAccessToken } from "better-auth/oauth2";
import { isOAuthDebugLogging, logOAuthDebug } from "@/lib/log/oauth-debug";
import { jwtClaimsToAuthInfo } from "@/lib/mcp/jwt-auth-info";
import {
  accessTokenLooksLikeJwt,
  verifyOpaqueAccessTokenForMcp,
} from "@/lib/mcp/opaque-token-verification";
import { type AuthFailure, INVALID_TOKEN_ERROR } from "./auth-errors";
import {
  getOAuthMcpAudienceUrls,
  getOAuthMcpResourceUrl,
  getOAuthTokenVerificationIssuers,
} from "./urls";

function boundedErrorMessage(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return message.slice(0, 180);
}

function errorCode(err: unknown) {
  if (!err || typeof err !== "object" || !("code" in err)) return undefined;
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" ? code.slice(0, 80) : undefined;
}

async function getLocalJwks() {
  const { authApi } = await import("@/lib/auth/core");
  return authApi.getJwks({});
}

export async function verifyAccessToken(
  request: Request,
  token: string,
): Promise<AuthInfo | AuthFailure> {
  const mcpAudience = getOAuthMcpResourceUrl();
  const issuers = getOAuthTokenVerificationIssuers();
  const audiences = getOAuthMcpAudienceUrls();

  if (accessTokenLooksLikeJwt(token)) {
    try {
      const jwt = await verifyOAuthAccessToken(token, {
        jwksFetch: getLocalJwks,
        verifyOptions: {
          issuer: issuers,
          audience: audiences,
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
        diagnostics: {
          acceptedAudienceCount: audiences.length,
          acceptedIssuerCount: issuers.length,
          authFailureKind: "jwt_verify_failed",
          authHeaderKind: "bearer",
          authTokenFormat: "jwt",
          jwtErrorCode: errorCode(err),
          jwtErrorMessage: boundedErrorMessage(err),
          jwtErrorName: err instanceof Error ? err.name : "unknown",
        },
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
    diagnostics: {
      authFailureKind: "opaque_token_miss",
      authHeaderKind: "bearer",
      authTokenFormat: "opaque",
    },
    error: INVALID_TOKEN_ERROR,
    status: 401,
    description: "Access token is invalid",
  };
}
