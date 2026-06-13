import { logOAuthDebug } from "@/lib/log/oauth-debug";
import { getOAuthMcpResourceUrl } from "@/lib/mcp/urls";
import {
  MCP_TOOLS_SCOPE,
  OAUTH_REFRESH_TOKEN_GRANT_TYPE,
} from "@/lib/oauth/constants";
import { hashOAuthClientSecretForDbStorage } from "@/lib/oauth/utils";
import { rewriteTokenFormRequest } from "./auth-token-request-rewrite";

export async function maybeBindMcpRefreshRequest(
  request: Request,
  params: URLSearchParams,
): Promise<Request> {
  if (
    params.get("grant_type") !== OAUTH_REFRESH_TOKEN_GRANT_TYPE ||
    params.has("resource")
  ) {
    return request;
  }

  const refreshToken = params.get("refresh_token");
  if (!refreshToken) {
    return request;
  }

  const refreshTokenHash =
    await hashOAuthClientSecretForDbStorage(refreshToken);
  const { prisma } = await import("@/lib/db/prisma");
  const refreshRecord = await prisma.oAuthRefreshToken.findUnique({
    where: { token: refreshTokenHash },
    select: { scopes: true },
  });
  if (!refreshRecord?.scopes.includes(MCP_TOOLS_SCOPE)) {
    return request;
  }

  params.set("resource", getOAuthMcpResourceUrl());
  logOAuthDebug("oauth.mcp-refresh-resource-bound", request, {
    path: new URL(request.url).pathname,
    scopeCount: refreshRecord.scopes.length,
  });
  return rewriteTokenFormRequest(request, params);
}
