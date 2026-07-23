import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { verifyJwsAccessToken as verifyOAuthAccessToken } from "better-auth/oauth2";
import { isOAuthDebugLogging, logOAuthDebug } from "@/lib/log/oauth-debug";
import { getSafeErrorName } from "@/lib/log/safe-error-name";
import { jwtClaimsToAuthInfo } from "@/lib/mcp/jwt-auth-info";
import {
  accessTokenLooksLikeJwt,
  verifyOpaqueAccessTokenForMcp,
} from "@/lib/mcp/opaque-token-verification";
import { hasActiveOAuthUserGrant } from "@/lib/oauth/active-user-grant";
import { OAUTH_GRANT_ID_CLAIM } from "@/lib/oauth/constants";
import { type AuthFailure, INVALID_TOKEN_ERROR } from "./auth-errors";
import {
  getOAuthMcpAudienceUrls,
  getOAuthMcpResourceUrl,
  getOAuthTokenVerificationIssuers,
} from "./urls";

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
    let jwtClaims: {
      aud?: unknown;
      azp?: unknown;
      exp?: unknown;
      scope?: unknown;
      sub?: unknown;
      [OAUTH_GRANT_ID_CLAIM]?: unknown;
    };
    try {
      const jwt = await verifyOAuthAccessToken(token, {
        jwksFetch: getLocalJwks,
        verifyOptions: {
          issuer: issuers,
          audience: audiences,
        },
      });
      jwtClaims = jwt as {
        aud?: unknown;
        azp?: unknown;
        exp?: unknown;
        scope?: unknown;
        sub?: unknown;
        [OAUTH_GRANT_ID_CLAIM]?: unknown;
      };
    } catch (err) {
      if (isOAuthDebugLogging()) {
        logOAuthDebug("mcp.jwt-verify-failed", request, {
          errorName: getSafeErrorName(err),
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
          jwtErrorName: getSafeErrorName(err),
        },
        error: INVALID_TOKEN_ERROR,
        status: 401,
        description: "Access token is invalid",
      };
    }

    const userId = typeof jwtClaims.sub === "string" ? jwtClaims.sub : "";
    const clientId = typeof jwtClaims.azp === "string" ? jwtClaims.azp : "";
    const grantId =
      typeof jwtClaims[OAUTH_GRANT_ID_CLAIM] === "string"
        ? jwtClaims[OAUTH_GRANT_ID_CLAIM]
        : undefined;
    const scopes =
      typeof jwtClaims.scope === "string"
        ? jwtClaims.scope.split(/\s+/).filter(Boolean)
        : [];
    try {
      if (
        !userId ||
        !clientId ||
        !(await hasActiveOAuthUserGrant({
          clientId,
          grantId,
          requireGrantBinding: true,
          scopes,
          userId,
        }))
      ) {
        return {
          diagnostics: {
            authFailureKind: "inactive_oauth_grant",
            authHeaderKind: "bearer",
            authTokenFormat: "jwt",
          },
          error: INVALID_TOKEN_ERROR,
          status: 401,
          description: "OAuth authorization grant is inactive",
        };
      }
    } catch {
      return {
        diagnostics: {
          authFailureKind: "inactive_oauth_grant",
          authHeaderKind: "bearer",
          authTokenFormat: "jwt",
        },
        error: INVALID_TOKEN_ERROR,
        status: 401,
        description: "OAuth authorization grant could not be verified",
      };
    }

    return jwtClaimsToAuthInfo({
      token,
      jwtClaims,
      mcpAudience,
    });
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
