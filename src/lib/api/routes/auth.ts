import {
  logOAuthDebug,
  summarizeOAuthForwardingHeaders,
  summarizeOAuthRedirectUri,
  withBetterAuthOAuthDebug,
} from "@/lib/log/oauth-debug";
import {
  OAUTH_AUTHORIZATION_CODE_GRANT_TYPE,
  OAUTH_DEVICE_CODE_GRANT_TYPE,
  OAUTH_PROVIDER_GRANT_TYPES,
  OAUTH_REFRESH_TOKEN_GRANT_TYPE,
} from "@/lib/oauth/constants";
import { resolveEquivalentLoopbackRedirectUri } from "@/lib/oauth/loopback-redirect";

const DEVICE_REGISTRATION_DELEGATED_REDIRECT_URI =
  "http://127.0.0.1/oauth/device-registration-callback";
const OAUTH_PROVIDER_GRANT_TYPE_SET = new Set<string>(
  OAUTH_PROVIDER_GRANT_TYPES,
);
const DYNAMIC_CLIENT_REGISTRATION_GRANT_TYPE_SET = new Set<string>([
  ...OAUTH_PROVIDER_GRANT_TYPES,
  OAUTH_DEVICE_CODE_GRANT_TYPE,
]);

type DeviceRegistrationMetadata = {
  grantTypes: string[];
  redirectUris?: string[];
};

function isOAuthClientRegistrationRequest(request: Request) {
  return new URL(request.url).pathname.endsWith("/oauth2/register");
}

type OAuthClientRegistrationPreparation =
  | { request: Request; deviceRegistration: DeviceRegistrationMetadata | null }
  | { response: Response };

async function prepareOAuthClientRegistrationRequest(
  request: Request,
): Promise<OAuthClientRegistrationPreparation> {
  if (!isOAuthClientRegistrationRequest(request)) {
    return { request, deviceRegistration: null };
  }

  let body: unknown;
  try {
    body = await request.clone().json();
  } catch {
    return { request, deviceRegistration: null };
  }

  const bodyObject =
    body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!bodyObject) {
    return { request, deviceRegistration: null };
  }

  const grantTypes = Array.isArray(bodyObject.grant_types)
    ? bodyObject.grant_types
    : null;
  if (!grantTypes) {
    return { request, deviceRegistration: null };
  }

  const unsupportedGrantType = grantTypes.find(
    (grantType) =>
      typeof grantType !== "string" ||
      !DYNAMIC_CLIENT_REGISTRATION_GRANT_TYPE_SET.has(grantType),
  );
  if (unsupportedGrantType === undefined) {
    if (!grantTypes.includes(OAUTH_DEVICE_CODE_GRANT_TYPE)) {
      return { request, deviceRegistration: null };
    }

    const providerGrantTypes = grantTypes.filter((grantType) =>
      OAUTH_PROVIDER_GRANT_TYPE_SET.has(grantType),
    );
    const delegatedGrantTypes =
      providerGrantTypes.length > 0
        ? providerGrantTypes
        : [OAUTH_REFRESH_TOKEN_GRANT_TYPE];
    const redirectUris = Array.isArray(bodyObject.redirect_uris)
      ? bodyObject.redirect_uris
      : null;
    const shouldInjectRedirectUri =
      !grantTypes.includes(OAUTH_AUTHORIZATION_CODE_GRANT_TYPE) &&
      (!redirectUris || redirectUris.length === 0);
    const delegatedRedirectUris = shouldInjectRedirectUri
      ? [DEVICE_REGISTRATION_DELEGATED_REDIRECT_URI]
      : redirectUris;
    const headers = new Headers(request.headers);
    headers.set("content-type", "application/json");

    return {
      request: new Request(request, {
        body: JSON.stringify({
          ...bodyObject,
          grant_types: delegatedGrantTypes,
          ...(delegatedRedirectUris
            ? { redirect_uris: delegatedRedirectUris }
            : {}),
        }),
        headers,
      }),
      deviceRegistration: {
        grantTypes,
        ...(shouldInjectRedirectUri ? { redirectUris: [] } : {}),
      },
    };
  }

  return {
    response: Response.json(
      {
        error: "invalid_client_metadata",
        error_description: `Unsupported grant type: ${String(unsupportedGrantType)}`,
      },
      { status: 400 },
    ),
  };
}

async function restoreDeviceRegistrationGrantTypes(
  response: Response,
  registration: DeviceRegistrationMetadata | null,
) {
  if (!registration || !response.ok) {
    return response;
  }

  const body = (await response
    .clone()
    .json()
    .catch(() => null)) as {
    client_id?: unknown;
    grant_types?: unknown;
  } | null;
  if (!body || typeof body.client_id !== "string") {
    return response;
  }

  const { prisma } = await import("@/lib/db/prisma");
  await prisma.oAuthClient.update({
    where: { clientId: body.client_id },
    data: {
      grantTypes: registration.grantTypes,
      ...(registration.redirectUris !== undefined
        ? { redirectUris: registration.redirectUris }
        : {}),
    },
  });

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return Response.json(
    {
      ...body,
      grant_types: registration.grantTypes,
      ...(registration.redirectUris !== undefined
        ? { redirect_uris: registration.redirectUris }
        : {}),
    },
    {
      status: response.status,
      headers,
    },
  );
}

async function authHandler(request: Request) {
  const { betterAuthInstance } = await import("@/lib/auth/core");
  return betterAuthInstance.handler(request);
}

async function maybeNormalizeAuthorizeLoopbackRedirectRequest(
  request: Request,
): Promise<Request> {
  const url = new URL(request.url);
  if (!url.pathname.endsWith("/oauth2/authorize")) {
    return request;
  }

  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  if (!clientId || !redirectUri) {
    return request;
  }

  logOAuthDebug("oauth.authorize.request-observed", request, {
    path: url.pathname,
    clientIdPrefix: clientId.slice(0, 16),
    ...summarizeOAuthRedirectUri(redirectUri),
    ...summarizeOAuthForwardingHeaders(request, url),
  });

  const { prisma } = await import("@/lib/db/prisma");
  const client = await prisma.oAuthClient.findUnique({
    where: { clientId },
    select: { redirectUris: true },
  });
  if (!client) {
    return request;
  }

  const normalizedRedirectUri = resolveEquivalentLoopbackRedirectUri(
    client.redirectUris,
    redirectUri,
  );
  if (!normalizedRedirectUri || normalizedRedirectUri === redirectUri) {
    return request;
  }

  url.searchParams.set("redirect_uri", normalizedRedirectUri);
  logOAuthDebug("oauth.loopback-redirect-normalized", request, {
    path: url.pathname,
    clientIdPrefix: clientId.slice(0, 16),
    fromRedirect: summarizeOAuthRedirectUri(redirectUri),
    toRedirect: summarizeOAuthRedirectUri(normalizedRedirectUri),
  });
  return new Request(url, request);
}

export const authGetRoute = async (request: Request) =>
  withBetterAuthOAuthDebug(
    "GET",
    await maybeNormalizeAuthorizeLoopbackRedirectRequest(request),
    authHandler,
  );

export const authPostRoute = async (request: Request) => {
  const prepared = await prepareOAuthClientRegistrationRequest(request);
  if ("response" in prepared) return prepared.response;
  const response = await withBetterAuthOAuthDebug(
    "POST",
    prepared.request,
    authHandler,
  );
  return restoreDeviceRegistrationGrantTypes(
    response,
    prepared.deviceRegistration,
  );
};

export const authPatchRoute = (request: Request) =>
  withBetterAuthOAuthDebug("PATCH", request, authHandler);

export const authPutRoute = (request: Request) =>
  withBetterAuthOAuthDebug("PUT", request, authHandler);

export const authDeleteRoute = (request: Request) =>
  withBetterAuthOAuthDebug("DELETE", request, authHandler);
