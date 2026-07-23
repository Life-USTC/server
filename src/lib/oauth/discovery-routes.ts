import type { RequestHandler } from "@sveltejs/kit";
import {
  createDiscoveryJsonResponse,
  createDiscoveryMetadataRoute,
  createDiscoveryRedirectRoute,
  getAuthServerMetadataResponse,
  getOpenIdMetadataResponse,
} from "@/lib/oauth/discovery-metadata";
import {
  getGraphqlServerUrl,
  getMcpServerUrl,
  getOAuthAuthorizationServerMetadataUrl,
  getOAuthIssuerUrl,
  getOAuthOpenIdConfigurationUrl,
  getOAuthProtectedResourceMetadataUrl,
} from "@/lib/oauth/metadata-urls";
import { PUBLIC_REST_SCOPES } from "@/lib/oauth/scope-registry";

function getProtectedResourceMetadataResponse({
  documentationPath,
  resource,
}: {
  documentationPath?: string;
  resource: URL;
}) {
  const issuerUrl = getOAuthIssuerUrl();

  return createDiscoveryJsonResponse({
    resource: resource.toString(),
    authorization_servers: [issuerUrl.toString()],
    scopes_supported: [...PUBLIC_REST_SCOPES],
    bearer_methods_supported: ["header"],
    ...(documentationPath
      ? {
          resource_documentation: new URL(
            documentationPath,
            issuerUrl,
          ).toString(),
        }
      : {}),
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
    getResponse: () =>
      getProtectedResourceMetadataResponse({
        documentationPath: "/api/docs/tag/catalog-section",
        resource: getMcpServerUrl(),
      }),
  },
  protectedResourceAlias: {
    type: "redirect",
    resolveUrl: getOAuthProtectedResourceMetadataUrl,
  },
  graphqlProtectedResourceMetadata: {
    type: "metadata",
    getResponse: () =>
      getProtectedResourceMetadataResponse({
        resource: getGraphqlServerUrl(),
      }),
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
