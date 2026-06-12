import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { MCP_TOOLS_SCOPE } from "@/lib/oauth/constants";
import { resourceIndicatorsMatch } from "@/lib/oauth/utils";
import {
  buildAuthErrorResponse,
  INSUFFICIENT_SCOPE_ERROR,
  INVALID_TOKEN_ERROR,
} from "./auth-errors";
import { verifyAccessToken } from "./auth-token-verification";
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

  if (!authInfo.scopes.includes(MCP_TOOLS_SCOPE)) {
    return {
      response: buildAuthErrorResponse(
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
