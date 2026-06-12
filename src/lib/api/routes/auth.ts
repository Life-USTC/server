import {
  logOAuthDebug,
  summarizeOAuthForwardingHeaders,
  summarizeOAuthRedirectUri,
  withBetterAuthOAuthDebug,
} from "@/lib/log/oauth-debug";
import { resolveEquivalentLoopbackRedirectUri } from "@/lib/oauth/loopback-redirect";

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

export const authPostRoute = (request: Request) =>
  withBetterAuthOAuthDebug("POST", request, authHandler);

export const authPatchRoute = (request: Request) =>
  withBetterAuthOAuthDebug("PATCH", request, authHandler);

export const authPutRoute = (request: Request) =>
  withBetterAuthOAuthDebug("PUT", request, authHandler);

export const authDeleteRoute = (request: Request) =>
  withBetterAuthOAuthDebug("DELETE", request, authHandler);
