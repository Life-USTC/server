import { prisma } from "@/lib/db/prisma";
import { logOAuthDebug } from "@/lib/log/oauth-debug";
import { getOAuthMcpResourceUrl } from "@/lib/mcp/urls";
import { OAUTH_REFRESH_TOKEN_GRANT_TYPE } from "@/lib/oauth/constants";
import { hasMcpScope } from "@/lib/oauth/scope-registry";
import {
  hashOAuthClientSecretForDbStorage,
  resourceIndicatorsMatch,
} from "@/lib/oauth/utils";
import { rewriteTokenFormRequest } from "./auth-token-request-rewrite";

function includesMcpResource(resources: string[]) {
  const mcpResource = getOAuthMcpResourceUrl();
  return resources.some((resource) =>
    resourceIndicatorsMatch(resource, mcpResource),
  );
}

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
  const refreshRecord = await prisma.oAuthRefreshToken.findUnique({
    where: { token: refreshTokenHash },
    select: { resources: true, scopes: true },
  });
  if (
    !refreshRecord ||
    !hasMcpScope(refreshRecord.scopes) ||
    !includesMcpResource(refreshRecord.resources)
  ) {
    return request;
  }

  params.set("resource", getOAuthMcpResourceUrl());
  logOAuthDebug("oauth.mcp-refresh-resource-bound", request, {
    path: new URL(request.url).pathname,
    scopeCount: refreshRecord.scopes.length,
  });
  return rewriteTokenFormRequest(request, params);
}
