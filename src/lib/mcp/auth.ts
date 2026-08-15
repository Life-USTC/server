import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { hasMcpScope, MCP_BOOTSTRAP_SCOPE } from "@/lib/oauth/scope-registry";
import { resourceIndicatorsMatch } from "@/lib/oauth/utils";
import {
  buildAuthErrorResponse,
  INSUFFICIENT_SCOPE_ERROR,
  INVALID_TOKEN_ERROR,
  type McpAuthFailureDiagnostics,
} from "./auth-errors";
import {
  accessTokenLooksLikeJwt,
  verifyMcpAccessTokenRequest,
} from "./auth-token-verification";
import {
  getRequiredMcpScopes,
  mcpToolCallsRequireAuthentication,
} from "./tool-scopes";
import { getOAuthMcpResourceUrl } from "./urls";

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
  const verified = await verifyMcpAccessTokenRequest(request);
  if ("response" in verified) return verified;
  const { authInfo } = verified;

  const tokenResourceMatchesMcp =
    authInfo.resource !== undefined &&
    resourceIndicatorsMatch(authInfo.resource, getOAuthMcpResourceUrl());
  if (!authInfo.resource || !tokenResourceMatchesMcp) {
    const diagnostics: McpAuthFailureDiagnostics = {
      authFailureKind: "token_resource_unbound",
      authHeaderKind: "bearer",
      authTokenFormat: tokenFormat(authInfo.token),
      scopeCount: authInfo.scopes.length,
      tokenResourceMatchesMcp,
      tokenResourcePresent: authInfo.resource !== undefined,
    };
    return {
      authFailureDiagnostics: diagnostics,
      response: buildAuthErrorResponse(
        {
          diagnostics,
          error: INVALID_TOKEN_ERROR,
          status: 401,
          description: "Access token is not bound to this MCP resource",
        },
        [MCP_BOOTSTRAP_SCOPE],
      ),
    };
  }

  const toolNames =
    typeof toolName === "string"
      ? [toolName]
      : Array.isArray(toolName)
        ? toolName
        : [];
  if (
    mcpToolCallsRequireAuthentication(toolNames) &&
    !hasMcpScope(authInfo.scopes)
  ) {
    const diagnostics: McpAuthFailureDiagnostics = {
      authFailureKind: "missing_feature_scope",
      authHeaderKind: "bearer",
      authTokenFormat: tokenFormat(authInfo.token),
      requiredScopeCount: 1,
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
        [MCP_BOOTSTRAP_SCOPE],
      ),
    };
  }

  return authorizeMcpToolScopes(authInfo, toolName);
}

export function authorizeMcpToolScopes(
  authInfo: AuthInfo,
  toolName?: string | string[],
):
  | { authInfo: AuthInfo }
  | { authFailureDiagnostics: McpAuthFailureDiagnostics; response: Response } {
  const requiredScopes = getRequiredMcpScopes(toolName);
  const hasRequiredScope =
    requiredScopes.length === 0 ||
    requiredScopes.every((scope) =>
      hasRequiredFeatureScope(authInfo.scopes, scope),
    );
  if (!hasRequiredScope) {
    const challengeScopes = [
      ...new Set([...authInfo.scopes, ...requiredScopes]),
    ];
    const diagnostics: McpAuthFailureDiagnostics = {
      authFailureKind: "missing_required_tool_scope",
      authHeaderKind: "bearer",
      authTokenFormat: tokenFormat(authInfo.token),
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
          description: "Access token does not include the required tool scope",
        },
        challengeScopes,
      ),
    };
  }

  return { authInfo };
}
