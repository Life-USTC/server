import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import {
  REST_FEATURES,
  restReadScope,
  restWriteScope,
} from "@/lib/oauth/constants";
import {
  hasMcpScope,
  LEGACY_MCP_TOOLS_SCOPE,
} from "@/lib/oauth/scope-registry";
import { resourceIndicatorsMatch } from "@/lib/oauth/utils";
import {
  buildAuthErrorResponse,
  INSUFFICIENT_SCOPE_ERROR,
  INVALID_TOKEN_ERROR,
} from "./auth-errors";
import { verifyAccessToken } from "./auth-token-verification";
import { getRequiredMcpScopes } from "./tool-scopes";
import { getOAuthMcpResourceUrl } from "./urls";

export { verifyAccessToken };

function parseBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  const [type, token] = authHeader.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export async function authenticateMcpRequest(
  request: Request,
  toolName?: string | string[],
): Promise<{ authInfo: AuthInfo } | { response: Response }> {
  const token = parseBearerToken(request);
  if (!token) {
    return {
      response: buildAuthErrorResponse({
        error: INVALID_TOKEN_ERROR,
        status: 401,
        description: "Missing bearer token",
      }),
    };
  }

  const authInfo = await verifyAccessToken(request, token);
  if ("error" in authInfo) {
    return { response: buildAuthErrorResponse(authInfo) };
  }

  if (
    !authInfo.resource ||
    !resourceIndicatorsMatch(authInfo.resource, getOAuthMcpResourceUrl())
  ) {
    return {
      response: buildAuthErrorResponse({
        error: INVALID_TOKEN_ERROR,
        status: 401,
        description: "Access token is not bound to this MCP resource",
      }),
    };
  }

  if (!hasMcpScope(authInfo.scopes)) {
    return {
      response: buildAuthErrorResponse(
        {
          error: INSUFFICIENT_SCOPE_ERROR,
          status: 403,
          description: "Access token does not include a feature scope",
        },
        REST_FEATURES.flatMap((feature) => [
          restReadScope(feature),
          restWriteScope(feature),
        ]),
      ),
    };
  }

  const requiredScopes = getRequiredMcpScopes(toolName);
  const hasRequiredScope =
    requiredScopes.length === 0 ||
    requiredScopes.some(
      (scope) =>
        authInfo.scopes.includes(scope) ||
        authInfo.scopes.includes(LEGACY_MCP_TOOLS_SCOPE),
    );
  if (!hasRequiredScope) {
    return {
      response: buildAuthErrorResponse(
        {
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
