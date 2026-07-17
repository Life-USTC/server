import { prisma } from "@/lib/db/prisma";
import { logOAuthDebug } from "@/lib/log/oauth-debug";
import { OAUTH_REFRESH_TOKEN_GRANT_TYPE } from "@/lib/oauth/constants";
import {
  getOAuthGraphqlResourceUrl,
  getOAuthMcpResourceUrl,
} from "@/lib/oauth/resource-urls";
import {
  expandScopeClaim,
  hasMcpScope,
  isFeatureScope,
} from "@/lib/oauth/scope-registry";
import {
  hashOAuthClientSecretForDbStorage,
  normalizeResourceIndicator,
  resourceIndicatorsMatch,
} from "@/lib/oauth/utils";
import { rewriteTokenFormRequest } from "./auth-token-request-rewrite";

function getApprovedProtectedResource(resources: string[], scopes: string[]) {
  let approvedResources: string[];
  try {
    approvedResources = resources.reduce<string[]>((unique, resource) => {
      const normalized = normalizeResourceIndicator(resource);
      if (
        !unique.some((approved) =>
          resourceIndicatorsMatch(approved, normalized),
        )
      ) {
        unique.push(normalized);
      }
      return unique;
    }, []);
  } catch {
    return undefined;
  }
  if (approvedResources.length !== 1) return undefined;

  const [resource] = approvedResources;
  if (resourceIndicatorsMatch(resource, getOAuthMcpResourceUrl())) {
    return hasMcpScope(scopes) ? getOAuthMcpResourceUrl() : undefined;
  }
  if (resourceIndicatorsMatch(resource, getOAuthGraphqlResourceUrl())) {
    return [...expandScopeClaim(scopes)].some(isFeatureScope)
      ? getOAuthGraphqlResourceUrl()
      : undefined;
  }
  return undefined;
}

export async function maybeBindOAuthRefreshResourceRequest(
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
  if (!refreshRecord) {
    return request;
  }

  const resource = getApprovedProtectedResource(
    refreshRecord.resources,
    refreshRecord.scopes,
  );
  if (!resource) return request;

  params.set("resource", resource);
  logOAuthDebug("oauth.refresh-resource-bound", request, {
    path: new URL(request.url).pathname,
    scopeCount: refreshRecord.scopes.length,
  });
  return rewriteTokenFormRequest(request, params);
}
