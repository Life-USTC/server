import {
  OAUTH_AUTHORIZATION_CODE_GRANT_TYPE,
  OAUTH_PROVIDER_GRANT_TYPES,
} from "@/lib/oauth/constants";

export function getOAuthClientAdmissionError(client: {
  clientDiscoveryId?: unknown;
  dpopBoundAccessTokens?: unknown;
  grantTypes?: unknown;
}): string | undefined {
  if (client.dpopBoundAccessTokens === true) {
    return "DPoP-bound access tokens are not supported by this Bearer-only resource server";
  }
  if (
    client.clientDiscoveryId === "cimd" &&
    (!Array.isArray(client.grantTypes) ||
      !client.grantTypes.includes(OAUTH_AUTHORIZATION_CODE_GRANT_TYPE))
  ) {
    return 'grant_types must include "authorization_code"';
  }
}

export function getCimdClientGrantTypes(grantTypes: unknown): string[] {
  return Array.isArray(grantTypes)
    ? grantTypes.filter((grantType) =>
        OAUTH_PROVIDER_GRANT_TYPES.some((allowed) => allowed === grantType),
      )
    : [];
}
