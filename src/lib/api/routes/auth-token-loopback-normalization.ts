import {
  logOAuthDebug,
  summarizeOAuthRedirectUri,
} from "@/lib/log/oauth-debug";
import { resolveEquivalentLoopbackRedirectUri } from "@/lib/oauth/loopback-redirect";
import { rewriteTokenFormRequest } from "./auth-token-request-rewrite";

export async function maybeNormalizeTokenLoopbackRedirectRequest(
  request: Request,
  params: URLSearchParams,
): Promise<Request> {
  const clientId = params.get("client_id");
  const redirectUri = params.get("redirect_uri");
  if (!clientId || !redirectUri) {
    return request;
  }

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

  params.set("redirect_uri", normalizedRedirectUri);
  logOAuthDebug("oauth.loopback-redirect-normalized", request, {
    path: new URL(request.url).pathname,
    clientIdPrefix: clientId.slice(0, 16),
    fromRedirect: summarizeOAuthRedirectUri(redirectUri),
    toRedirect: summarizeOAuthRedirectUri(normalizedRedirectUri),
  });
  return rewriteTokenFormRequest(request, params);
}
