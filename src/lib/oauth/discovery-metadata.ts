import {
  oauthProviderAuthServerMetadata,
  oauthProviderOpenIdConfigMetadata,
} from "@better-auth/oauth-provider";
import { NextResponse } from "next/server";
import { betterAuthInstance } from "@/auth";
import {
  OAUTH_DEVICE_AUTHORIZATION_ENDPOINT_PATH,
  OAUTH_DEVICE_CODE_GRANT_TYPE,
} from "@/lib/oauth/constants";
import { asOAuthProviderMetadataAuth } from "@/lib/oauth/provider-api";

const DISCOVERY_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

type DiscoveryMetadata = {
  issuer?: string;
  grant_types_supported?: string[];
  [key: string]: unknown;
};

const oauthProviderMetadataAuth =
  asOAuthProviderMetadataAuth(betterAuthInstance);
const authServerMetadataHandler = oauthProviderAuthServerMetadata(
  oauthProviderMetadataAuth,
);
const openIdConfigMetadataHandler = oauthProviderOpenIdConfigMetadata(
  oauthProviderMetadataAuth,
);

function withDiscoveryCorsHeaders(headers?: HeadersInit): Headers {
  const responseHeaders = new Headers(headers);
  for (const [key, value] of Object.entries(DISCOVERY_CORS_HEADERS)) {
    responseHeaders.set(key, value);
  }
  return responseHeaders;
}

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
    grant_types_supported: [
      ...new Set([
        ...(body.grant_types_supported ?? []),
        OAUTH_DEVICE_CODE_GRANT_TYPE,
      ]),
    ],
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
  return buildDiscoveryMetadataResponse(request, authServerMetadataHandler);
}

export async function getOpenIdMetadataResponse(request: Request) {
  return buildDiscoveryMetadataResponse(request, openIdConfigMetadataHandler);
}

function getDiscoveryOptionsResponse() {
  return new Response(null, {
    status: 204,
    headers: withDiscoveryCorsHeaders(),
  });
}

function getDiscoveryRedirectResponse(url: URL | string, status = 307) {
  return NextResponse.redirect(url, {
    status,
    headers: withDiscoveryCorsHeaders(),
  });
}

export function createDiscoveryJsonResponse(
  body: unknown,
  init: ResponseInit = {},
) {
  return NextResponse.json(body, {
    ...init,
    headers: withDiscoveryCorsHeaders(init.headers),
  });
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
