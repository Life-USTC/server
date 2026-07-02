import type { RequestHandler } from "@sveltejs/kit";
import {
  getMcpServerUrl,
  getOAuthAuthorizationServerMetadataUrl,
  getOAuthIssuerUrl,
  getOAuthOpenIdConfigurationUrl,
  getOAuthProtectedResourceMetadataUrl,
} from "@/lib/mcp/urls";
import {
  createDiscoveryJsonResponse,
  createDiscoveryMetadataRoute,
  createDiscoveryRedirectRoute,
  getAuthServerMetadataResponse,
  getOpenIdMetadataResponse,
} from "@/lib/oauth/discovery-metadata";
import { PUBLIC_REST_SCOPES } from "@/lib/oauth/scope-registry";

async function getProtectedResourceMetadataResponse() {
  const issuerUrl = getOAuthIssuerUrl();

  return createDiscoveryJsonResponse({
    resource: getMcpServerUrl().toString(),
    authorization_servers: [issuerUrl.toString()],
    scopes_supported: [...PUBLIC_REST_SCOPES],
    bearer_methods_supported: ["header"],
    resource_documentation: new URL(
      "/api/docs/tag/sections",
      issuerUrl,
    ).toString(),
  });
}

const DISCOVERY_TARGETS = {
  authServerMetadata: {
    type: "metadata",
    getResponse: getAuthServerMetadataResponse,
  },
  authServerAlias: {
    type: "redirect",
    resolveUrl: getOAuthAuthorizationServerMetadataUrl,
  },
  openIdMetadata: {
    type: "metadata",
    getResponse: getOpenIdMetadataResponse,
  },
  openIdAlias: {
    type: "redirect",
    resolveUrl: getOAuthOpenIdConfigurationUrl,
  },
  protectedResourceMetadata: {
    type: "metadata",
    getResponse: getProtectedResourceMetadataResponse,
  },
  protectedResourceAlias: {
    type: "redirect",
    resolveUrl: getOAuthProtectedResourceMetadataUrl,
  },
} as const;

type DiscoveryRouteTarget = keyof typeof DISCOVERY_TARGETS;
type RequestDiscoveryHandlers = ReturnType<typeof createDiscoveryMetadataRoute>;

function adaptDiscoveryRouteHandlers(handlers: RequestDiscoveryHandlers): {
  GET: RequestHandler;
  OPTIONS: RequestHandler;
} {
  return {
    GET: (event) => handlers.GET(event.request),
    OPTIONS: () => handlers.OPTIONS(),
  };
}

export function createOAuthDiscoveryRoute(target: DiscoveryRouteTarget) {
  const route = DISCOVERY_TARGETS[target];
  if (route.type === "metadata") {
    return adaptDiscoveryRouteHandlers(
      createDiscoveryMetadataRoute(route.getResponse),
    );
  }

  return adaptDiscoveryRouteHandlers(
    createDiscoveryRedirectRoute(route.resolveUrl),
  );
}
