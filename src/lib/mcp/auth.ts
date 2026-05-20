import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { verifyAccessToken as verifyOAuthAccessToken } from "better-auth/oauth2";
import { prisma } from "@/lib/db/prisma";
import { isOAuthDebugLogging, logOAuthDebug } from "@/lib/log/oauth-debug";
import {
  hashOAuthClientSecretForDbStorage,
  MCP_TOOLS_SCOPE,
  resourceIndicatorsMatch,
} from "@/lib/oauth/utils";
import {
  getJwksUrlForOAuthVerification,
  getOAuthMcpAudienceUrls,
  getOAuthMcpResourceUrl,
  getOAuthProtectedResourceMetadataUrl,
  getOAuthTokenVerificationIssuers,
} from "./urls";

const INVALID_TOKEN_ERROR = "invalid_token";
const INSUFFICIENT_SCOPE_ERROR = "insufficient_scope";

type AuthFailure = {
  error: string;
  status: number;
  description: string;
};

function buildBearerHeader({
  request,
  error,
  description,
  scopes,
}: {
  request: Request;
  error: string;
  description: string;
  scopes?: string[];
}) {
  const parts = [
    `Bearer error="${error}"`,
    `error_description="${description}"`,
    `resource_metadata="${getOAuthProtectedResourceMetadataUrl(request).toString()}"`,
  ];

  if (scopes && scopes.length > 0) {
    parts.push(`scope="${scopes.join(" ")}"`);
  }

  return parts.join(", ");
}

function buildAuthErrorResponse(
  request: Request,
  failure: AuthFailure,
  scopes?: string[],
) {
  return new Response(JSON.stringify({ error: failure.error }), {
    status: failure.status,
    headers: {
      "Content-Type": "application/json",
      "WWW-Authenticate": buildBearerHeader({
        request,
        error: failure.error,
        description: failure.description,
        scopes,
      }),
    },
  });
}

function parseBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  const [type, token] = authHeader.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

/** Compact JWS: three Base64url segments (OAuth JWT access tokens). */
function accessTokenLooksLikeJwt(token: string): boolean {
  const parts = token.split(".");
  return (
    parts.length === 3 &&
    parts[0].length > 0 &&
    parts[1].length > 0 &&
    parts[2].length > 0
  );
}

/**
 * When the token request omits `resource`, Better Auth oauth-provider issues an **opaque**
 * access token (stored hashed). ChatGPT does this; `verifyOAuthAccessToken` then fails with
 * "no token payload" because the string is not a JWS.
 */
async function verifyOpaqueAccessTokenForMcp(
  token: string,
): Promise<AuthFailure | null> {
  if (accessTokenLooksLikeJwt(token)) return null;

  const tokenHash = hashOAuthClientSecretForDbStorage(token);
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

      const scopeValue =
        typeof (jwt as { scope?: unknown }).scope === "string"
          ? (jwt as { scope: string }).scope
          : "";
      const scopes = scopeValue.split(" ").filter(Boolean);
      const aud = (jwt as { aud?: unknown }).aud;
      let audValue = "";
      if (typeof aud === "string") {
        audValue = aud;
      } else if (Array.isArray(aud)) {
        const mcpMatch = aud.find(
          (a) =>
            typeof a === "string" && resourceIndicatorsMatch(a, mcpAudience),
        );
        audValue = mcpMatch ?? String(aud[0] ?? "");
      }

      return {
        token,
        clientId:
          typeof (jwt as { azp?: unknown }).azp === "string"
            ? (jwt as { azp: string }).azp
            : "unknown",
        scopes,
        expiresAt:
          typeof (jwt as { exp?: unknown }).exp === "number"
            ? (jwt as { exp: number }).exp
            : Math.floor(Date.now() / 1000) + 60,
        resource: audValue ? new URL(audValue) : undefined,
        extra: {
          userId:
            typeof (jwt as { sub?: unknown }).sub === "string"
              ? (jwt as { sub: string }).sub
              : undefined,
        },
      };
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

export async function authenticateMcpRequest(
  request: Request,
): Promise<{ authInfo: AuthInfo } | { response: Response }> {
  const token = parseBearerToken(request);
  if (!token) {
    return {
      response: buildAuthErrorResponse(request, {
        error: INVALID_TOKEN_ERROR,
        status: 401,
        description: "Missing bearer token",
      }),
    };
  }

  const authInfo = await verifyAccessToken(request, token);
  if ("error" in authInfo) {
    return { response: buildAuthErrorResponse(request, authInfo) };
  }

  if (
    !authInfo.resource ||
    !resourceIndicatorsMatch(authInfo.resource, getOAuthMcpResourceUrl())
  ) {
    return {
      response: buildAuthErrorResponse(request, {
        error: INVALID_TOKEN_ERROR,
        status: 401,
        description: "Access token is not bound to this MCP resource",
      }),
    };
  }

  if (!authInfo.scopes.includes(MCP_TOOLS_SCOPE)) {
    return {
      response: buildAuthErrorResponse(
        request,
        {
          error: INSUFFICIENT_SCOPE_ERROR,
          status: 403,
          description: "Access token does not include the MCP scope",
        },
        [MCP_TOOLS_SCOPE],
      ),
    };
  }

  return { authInfo };
}
