import { handlers } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import {
  logOAuthDebug,
  summarizeOAuthForwardingHeaders,
  summarizeOAuthRedirectUri,
  withBetterAuthOAuthDebug,
} from "@/lib/log/oauth-debug";
import { resolveEquivalentLoopbackRedirectUri } from "@/lib/oauth/loopback-redirect";

export const dynamic = "force-dynamic";

/**
 * Better Auth handlers mounted on /api/auth/*.
 * @ignore
 */
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

export const GET = async (request: Request) =>
  withBetterAuthOAuthDebug(
    "GET",
    await maybeNormalizeAuthorizeLoopbackRedirectRequest(request),
    handlers.GET,
  );

export const POST = (request: Request) =>
  withBetterAuthOAuthDebug("POST", request, handlers.POST);

export const PATCH = (request: Request) =>
  withBetterAuthOAuthDebug("PATCH", request, handlers.PATCH);

export const PUT = (request: Request) =>
  withBetterAuthOAuthDebug("PUT", request, handlers.PUT);

export const DELETE = (request: Request) =>
  withBetterAuthOAuthDebug("DELETE", request, handlers.DELETE);
