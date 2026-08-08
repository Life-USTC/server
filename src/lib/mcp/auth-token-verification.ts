import { createMcpProtectedRequestHandler } from "@better-auth/mcp";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import {
  type AccessTokenAuthorization,
  parseAccessTokenAuthorization,
} from "better-auth/oauth2";
import type { JWTPayload } from "jose";
import { jwtClaimsToAuthInfo } from "@/lib/mcp/jwt-auth-info";
import { hasActiveOAuthUserGrant } from "@/lib/oauth/active-user-grant";
import { OAUTH_GRANT_ID_CLAIM } from "@/lib/oauth/constants";
import { MCP_BOOTSTRAP_SCOPE } from "@/lib/oauth/scope-registry";
import {
  type AuthFailure,
  buildAuthErrorResponse,
  INVALID_TOKEN_ERROR,
} from "./auth-errors";
import {
  getCanonicalOAuthIssuer,
  getJwksUrlForOAuthVerification,
  getOAuthMcpResourceUrl,
  getOAuthMcpResourceUrls,
} from "./urls";

/** Compact JWS: three non-empty Base64url segments. */
export function accessTokenLooksLikeJwt(token: string): boolean {
  const parts = token.split(".");
  return (
    parts.length === 3 &&
    parts[0].length > 0 &&
    parts[1].length > 0 &&
    parts[2].length > 0
  );
}

function tokenFormat(token: string) {
  return accessTokenLooksLikeJwt(token) ? "jwt" : "opaque";
}

function authHeaderKind(
  authorization: AccessTokenAuthorization | undefined,
): "missing" | "malformed" | "bearer" | "dpop" {
  if (!authorization) return "missing";
  if (authorization.scheme === "Bearer") return "bearer";
  if (authorization.scheme === "DPoP") return "dpop";
  return "malformed";
}

function addBootstrapScopeToBearerChallenges(response: Response): Response {
  if (response.status !== 401) return response;

  const challenge = response.headers.get("WWW-Authenticate");
  if (!challenge?.includes("Bearer resource_metadata=")) return response;

  const scopedChallenge = challenge.replace(
    /Bearer resource_metadata="[^"]*"(?!, scope=)/g,
    (value) => `${value}, scope="${MCP_BOOTSTRAP_SCOPE}"`,
  );
  if (scopedChallenge === challenge) return response;

  const headers = new Headers(response.headers);
  headers.set("WWW-Authenticate", scopedChallenge);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function resolveClientId(jwtClaims: JWTPayload): string {
  const azp = typeof jwtClaims.azp === "string" ? jwtClaims.azp : undefined;
  const clientId =
    typeof jwtClaims.client_id === "string" ? jwtClaims.client_id : undefined;
  if (azp && clientId && azp !== clientId) return "";
  return clientId ?? azp ?? "";
}

export async function authorizeVerifiedMcpAccessToken({
  authHeader = "bearer",
  jwtClaims,
  token,
}: {
  authHeader?: "bearer" | "dpop";
  jwtClaims: JWTPayload;
  token: string;
}): Promise<AuthInfo | AuthFailure> {
  const authInfo = jwtClaimsToAuthInfo({
    token,
    jwtClaims,
    mcpAudience: getOAuthMcpResourceUrl(),
  });
  const clientId = resolveClientId(jwtClaims);
  const userId = typeof jwtClaims.sub === "string" ? jwtClaims.sub : "";
  const grantId =
    typeof jwtClaims[OAUTH_GRANT_ID_CLAIM] === "string"
      ? jwtClaims[OAUTH_GRANT_ID_CLAIM]
      : undefined;

  try {
    if (
      !userId ||
      !clientId ||
      !(await hasActiveOAuthUserGrant({
        clientId,
        grantId,
        requireGrantBinding: true,
        scopes: authInfo.scopes,
        userId,
      }))
    ) {
      return {
        diagnostics: {
          authFailureKind: "inactive_oauth_grant",
          authHeaderKind: authHeader,
          authTokenFormat: tokenFormat(token),
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
        authHeaderKind: authHeader,
        authTokenFormat: tokenFormat(token),
      },
      error: INVALID_TOKEN_ERROR,
      status: 401,
      description: "OAuth authorization grant could not be verified",
    };
  }

  return authInfo;
}

export async function verifyMcpAccessTokenRequest(request: Request): Promise<
  | { authInfo: AuthInfo }
  | {
      authFailureDiagnostics: AuthFailure["diagnostics"];
      response: Response;
    }
> {
  const authorization = parseAccessTokenAuthorization(
    request.headers.get("authorization"),
  );
  const usesDpop =
    authorization?.scheme === "DPoP" || request.headers.has("DPoP");
  if (usesDpop || (authorization && authorization.scheme !== "Bearer")) {
    const diagnostics: AuthFailure["diagnostics"] = {
      authFailureKind: usesDpop
        ? "unsupported_dpop"
        : "malformed_authorization_header",
      authHeaderKind: authHeaderKind(authorization),
      authTokenFormat: authorization?.token
        ? tokenFormat(authorization.token)
        : "unknown",
    };
    const failure: AuthFailure = {
      diagnostics,
      error: INVALID_TOKEN_ERROR,
      status: 401,
      description: usesDpop
        ? "DPoP authorization is not supported for this MCP resource"
        : "Malformed authorization header",
    };
    return {
      authFailureDiagnostics: diagnostics,
      response: buildAuthErrorResponse(failure, [MCP_BOOTSTRAP_SCOPE]),
    };
  }

  let jwtClaims: JWTPayload | undefined;
  let upstreamResponse: Response | undefined;
  for (const audience of getOAuthMcpResourceUrls()) {
    const verifyRequest = createMcpProtectedRequestHandler(
      {
        issuer: getCanonicalOAuthIssuer(),
        audience,
        jwksUrl: getJwksUrlForOAuthVerification(),
      },
      (_request, verifiedClaims) => {
        jwtClaims = verifiedClaims;
        return new Response(null, { status: 204 });
      },
    );
    const response = await verifyRequest(request);
    upstreamResponse ??= response;
    if (jwtClaims) {
      upstreamResponse = response;
      break;
    }
  }
  if (!jwtClaims) {
    const kind = authHeaderKind(authorization);
    const token = authorization?.token;
    return {
      authFailureDiagnostics: {
        authFailureKind:
          kind === "missing" ? "missing_bearer" : "upstream_auth_rejected",
        authHeaderKind: kind,
        authTokenFormat:
          kind === "missing"
            ? "missing"
            : kind === "malformed" || !token
              ? "unknown"
              : tokenFormat(token),
      },
      response: addBootstrapScopeToBearerChallenges(
        upstreamResponse ?? new Response(null, { status: 401 }),
      ),
    };
  }

  if (!authorization?.token || authorization.scheme !== "Bearer") {
    throw new Error("MCP verifier accepted an invalid authorization header");
  }

  const verified = await authorizeVerifiedMcpAccessToken({
    authHeader: "bearer",
    jwtClaims,
    token: authorization.token,
  });
  if ("error" in verified) {
    return {
      authFailureDiagnostics: verified.diagnostics,
      response: buildAuthErrorResponse(verified, [MCP_BOOTSTRAP_SCOPE]),
    };
  }

  return { authInfo: verified };
}
