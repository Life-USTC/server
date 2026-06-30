import {
  oauthProviderAuthServerMetadata,
  oauthProviderOpenIdConfigMetadata,
} from "@better-auth/oauth-provider";
import {
  OAUTH_DEVICE_AUTHORIZATION_ENDPOINT_PATH,
  OAUTH_USER_DELEGATED_GRANT_TYPES,
} from "@/lib/oauth/constants";
import {
  createDiscoveryJsonResponse,
  getDiscoveryOptionsResponse,
  getDiscoveryRedirectResponse,
} from "@/lib/oauth/discovery-responses";
import { asOAuthProviderMetadataAuth } from "@/lib/oauth/provider-api";
import { OAUTH_SCOPES } from "@/lib/oauth/scope-registry";

export { createDiscoveryJsonResponse } from "@/lib/oauth/discovery-responses";

type DiscoveryMetadata = {
  issuer?: string;
  grant_types_supported?: string[];
  [key: string]: unknown;
};

function augmentDiscoveryMetadata(
  request: Request,
  body: DiscoveryMetadata,
): DiscoveryMetadata {
  const siteOrigin = body.issuer
    ? new URL(body.issuer).origin
    : new URL(request.url).origin;

  return {
    ...body,
    device_authorization_endpoint: `${siteOrigin}${OAUTH_DEVICE_AUTHORIZATION_ENDPOINT_PATH}`,
    grant_types_supported: [...OAUTH_USER_DELEGATED_GRANT_TYPES],
    scopes_supported: [...OAUTH_SCOPES],
  };
}

async function buildDiscoveryMetadataResponse(
  request: Request,
  handler: (request: Request) => Promise<Response>,
): Promise<Response> {
  const response = await handler(request);
  const body = (await response.json()) as DiscoveryMetadata;

  return createDiscoveryJsonResponse(augmentDiscoveryMetadata(request, body), {
    status: response.status,
    headers: response.headers,
  });
}

export async function getAuthServerMetadataResponse(request: Request) {
  const { betterAuthInstance } = await import("@/lib/auth/core");
  const authServerMetadataHandler = oauthProviderAuthServerMetadata(
    asOAuthProviderMetadataAuth(betterAuthInstance),
  );
  return buildDiscoveryMetadataResponse(request, authServerMetadataHandler);
}

export async function getOpenIdMetadataResponse(request: Request) {
  const { betterAuthInstance } = await import("@/lib/auth/core");
  const openIdConfigMetadataHandler = oauthProviderOpenIdConfigMetadata(
    asOAuthProviderMetadataAuth(betterAuthInstance),
  );
  return buildDiscoveryMetadataResponse(request, openIdConfigMetadataHandler);
}

type DiscoveryRouteHandlers = {
  GET: (request: Request) => Promise<Response> | Response;
  OPTIONS: typeof getDiscoveryOptionsResponse;
};

export function createDiscoveryMetadataRoute(
  getResponse: (request: Request) => Promise<Response> | Response,
): DiscoveryRouteHandlers {
  return {
    GET: getResponse,
    OPTIONS: getDiscoveryOptionsResponse,
  };
}

export function createDiscoveryRedirectRoute(
  resolveUrl: (request: Request) => URL | string,
  status = 307,
): DiscoveryRouteHandlers {
  return createDiscoveryMetadataRoute((request) =>
    getDiscoveryRedirectResponse(resolveUrl(request), status),
  );
}
