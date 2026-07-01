import {
  type DeviceRegistrationMetadata,
  prepareOAuthClientRegistrationDelegation,
  restoreRegisteredDeviceClientMetadata,
} from "@/features/oauth/server/client-registration-policy.server";
import { prisma } from "@/lib/db/prisma";
import {
  logOAuthDebug,
  summarizeOAuthForwardingHeaders,
  summarizeOAuthRedirectUri,
  withBetterAuthOAuthDebug,
} from "@/lib/log/oauth-debug";
import { resolveEquivalentLoopbackRedirectUri } from "@/lib/oauth/loopback-redirect";
import { rewriteOAuthResourceAliases } from "@/lib/oauth/resource-aliases";

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

  const prepared = prepareOAuthClientRegistrationDelegation(bodyObject);
  if ("error" in prepared) {
    return {
      response: Response.json(
        {
          error: prepared.error.error,
          error_description: prepared.error.errorDescription,
        },
        { status: 400 },
      ),
    };
  }

  if (!prepared.delegatedBody) {
    return { request, deviceRegistration: null };
  }

  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");

  return {
    request: new Request(request, {
      body: JSON.stringify(prepared.delegatedBody),
      headers,
    }),
    deviceRegistration: prepared.deviceRegistration,
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

  const restored = await restoreRegisteredDeviceClientMetadata({
    body,
    registration,
  });
  if (!restored) return response;

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return Response.json(
    {
      ...body,
      ...restored,
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

function maybeNormalizeAuthorizeResourceRequest(request: Request): Request {
  const url = new URL(request.url);
  if (!url.pathname.endsWith("/oauth2/authorize")) {
    return request;
  }

  const params = new URLSearchParams(url.searchParams);
  if (!rewriteOAuthResourceAliases(params)) {
    return request;
  }

  url.search = params.toString();
  logOAuthDebug("oauth.resource-alias-normalized", request, {
    path: url.pathname,
  });
  return new Request(url, request);
}

export const authGetRoute = async (request: Request) =>
  withBetterAuthOAuthDebug(
    "GET",
    await maybeNormalizeAuthorizeLoopbackRedirectRequest(
      maybeNormalizeAuthorizeResourceRequest(request),
    ),
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
