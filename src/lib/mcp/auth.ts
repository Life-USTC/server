import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import {
  hasMcpScope,
  LEGACY_MCP_TOOLS_SCOPE,
  PUBLIC_REST_SCOPES,
} from "@/lib/oauth/scope-registry";
import { resourceIndicatorsMatch } from "@/lib/oauth/utils";
import {
  buildAuthErrorResponse,
  INSUFFICIENT_SCOPE_ERROR,
  INVALID_TOKEN_ERROR,
  type McpAuthFailureDiagnostics,
} from "./auth-errors";
import { verifyAccessToken } from "./auth-token-verification";
import { accessTokenLooksLikeJwt } from "./opaque-token-verification";
import { getRequiredMcpScopes } from "./tool-scopes";
import { getOAuthMcpResourceUrl } from "./urls";

export { verifyAccessToken };

type BearerTokenParseResult =
  | { kind: "missing" }
  | { kind: "malformed" }
  | { kind: "bearer"; token: string };

function parseBearerToken(request: Request): BearerTokenParseResult {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return { kind: "missing" };

  const [type, token] = authHeader.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) {
    return { kind: "malformed" };
  }

  return { kind: "bearer", token };
}

function tokenFormat(
  token: string,
): McpAuthFailureDiagnostics["authTokenFormat"] {
  return accessTokenLooksLikeJwt(token) ? "jwt" : "opaque";
}

function toolNameCount(toolName: string | string[] | undefined) {
  if (Array.isArray(toolName)) return toolName.length;
  return toolName ? 1 : 0;
}

function hasRequiredFeatureScope(
  grantedScopes: readonly string[],
  requiredScope: string,
) {
  if (grantedScopes.includes(requiredScope)) return true;
  const readScope = /^(.*):read$/.exec(requiredScope);
  return readScope ? grantedScopes.includes(`${readScope[1]}:write`) : false;
}

export async function authenticateMcpRequest(
  request: Request,
  toolName?: string | string[],
): Promise<
  | { authInfo: AuthInfo }
  | { authFailureDiagnostics: McpAuthFailureDiagnostics; response: Response }
> {
  const parsedToken = parseBearerToken(request);
  if (parsedToken.kind !== "bearer") {
    const diagnostics: McpAuthFailureDiagnostics = {
      authFailureKind:
        parsedToken.kind === "missing"
          ? "missing_bearer"
          : "malformed_authorization_header",
      authHeaderKind: parsedToken.kind,
      authTokenFormat: parsedToken.kind === "missing" ? "missing" : "unknown",
    };
    return {
      authFailureDiagnostics: diagnostics,
      response: buildAuthErrorResponse({
        diagnostics,
        error: INVALID_TOKEN_ERROR,
        status: 401,
        description:
          parsedToken.kind === "missing"
            ? "Missing bearer token"
            : "Malformed authorization header",
      }),
    };
  }

  const token = parsedToken.token;
  const authInfo = await verifyAccessToken(request, token);
  if ("error" in authInfo) {
    return {
      authFailureDiagnostics: authInfo.diagnostics,
      response: buildAuthErrorResponse(authInfo),
    };
  }

  const tokenResourceMatchesMcp =
    authInfo.resource !== undefined &&
    resourceIndicatorsMatch(authInfo.resource, getOAuthMcpResourceUrl());
  if (!authInfo.resource || !tokenResourceMatchesMcp) {
    const diagnostics: McpAuthFailureDiagnostics = {
      authFailureKind: "token_resource_unbound",
      authHeaderKind: "bearer",
      authTokenFormat: tokenFormat(token),
      scopeCount: authInfo.scopes.length,
      tokenResourceMatchesMcp,
      tokenResourcePresent: authInfo.resource !== undefined,
    };
    return {
      authFailureDiagnostics: diagnostics,
      response: buildAuthErrorResponse({
        diagnostics,
        error: INVALID_TOKEN_ERROR,
        status: 401,
        description: "Access token is not bound to this MCP resource",
      }),
    };
  }

  if (!hasMcpScope(authInfo.scopes)) {
    const diagnostics: McpAuthFailureDiagnostics = {
      authFailureKind: "missing_feature_scope",
      authHeaderKind: "bearer",
      authTokenFormat: tokenFormat(token),
      requiredScopeCount: PUBLIC_REST_SCOPES.length,
      scopeCount: authInfo.scopes.length,
      tokenResourceMatchesMcp: true,
      tokenResourcePresent: true,
    };
    return {
      authFailureDiagnostics: diagnostics,
      response: buildAuthErrorResponse(
        {
          diagnostics,
          error: INSUFFICIENT_SCOPE_ERROR,
          status: 403,
          description: "Access token does not include a feature scope",
        },
        PUBLIC_REST_SCOPES,
      ),
    };
  }

  const requiredScopes = getRequiredMcpScopes(toolName);
  const hasLegacyMcpToolsScope = authInfo.scopes.includes(
    LEGACY_MCP_TOOLS_SCOPE,
  );
  const hasRequiredScope =
    requiredScopes.length === 0 ||
    hasLegacyMcpToolsScope ||
    requiredScopes.every((scope) =>
      hasRequiredFeatureScope(authInfo.scopes, scope),
    );
  if (!hasRequiredScope) {
    const diagnostics: McpAuthFailureDiagnostics = {
      authFailureKind: "missing_required_tool_scope",
      authHeaderKind: "bearer",
      authTokenFormat: tokenFormat(token),
      requiredScopeCount: requiredScopes.length,
      scopeCount: authInfo.scopes.length,
      tokenResourceMatchesMcp: true,
      tokenResourcePresent: true,
      toolNameCount: toolNameCount(toolName),
    };
    return {
      authFailureDiagnostics: diagnostics,
      response: buildAuthErrorResponse(
        {
          diagnostics,
          error: INSUFFICIENT_SCOPE_ERROR,
          status: 403,
          description: `Access token does not include a required scope for tool(s): ${Array.isArray(toolName) ? toolName.join(", ") : toolName}`,
        },
        requiredScopes,
      ),
    };
  }

  return { authInfo };
}
