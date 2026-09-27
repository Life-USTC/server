import type { RequestHandler } from "@sveltejs/kit";
import {
  createDiscoveryJsonResponse,
  createDiscoveryMetadataRoute,
  getAuthServerMetadataResponse,
  getMcpProtectedResourceMetadataResponse,
  getOpenIdMetadataResponse,
} from "@/lib/oauth/discovery-metadata";
import {
  getGraphqlServerUrl,
  getOAuthIssuerUrl,
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
    getResponse: getAuthServerMetadataResponse,
  },
  openIdMetadata: {
    getResponse: getOpenIdMetadataResponse,
  },
  protectedResourceMetadata: {
    getResponse: getMcpProtectedResourceMetadataResponse,
  },
  graphqlProtectedResourceMetadata: {
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
  return adaptDiscoveryRouteHandlers(
    createDiscoveryMetadataRoute(DISCOVERY_TARGETS[target].getResponse),
  );
}
