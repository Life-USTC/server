import { isLoopbackHost } from "@better-auth/core/utils/host";
import type { ServerLoadEvent } from "@sveltejs/kit";
import { redirect } from "@sveltejs/kit";
import {
  formatOAuthMessage,
  getOAuthCopy,
  oauthScopeLabel,
} from "@/features/oauth/lib/oauth-copy";
import { buildSignInPageUrl } from "@/lib/auth/auth-routing";
import { asOAuthProviderApi } from "@/lib/oauth/provider-api";
import {
  currentOAuthAuthorizePath,
  parseOAuthScopes,
} from "./oauth-authorize-form";
import { submitOAuthConsentAction } from "./oauth-consent-action";

function parseOAuthHost(value: string | null) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
      return null;
    return {
      host: parsed.host,
      loopback: isLoopbackHost(parsed.hostname),
    };
  } catch {
    return null;
  }
}

export const loadOAuthAuthorizePage = async ({
  locals,
  request,
  url,
}: ServerLoadEvent) => {
  const { authApi, getSessionFromHeaders } = await import("@/lib/auth/core");
  const session = await getSessionFromHeaders(request.headers);
  if (!session?.user?.id) {
    throw redirect(303, buildSignInPageUrl(currentOAuthAuthorizePath(url)));
  }

  const copy = getOAuthCopy(locals.locale);
  const clientId = url.searchParams.get("client_id");
  const oauthQuery = url.searchParams.toString();
  const scopes = parseOAuthScopes(url.searchParams.get("scope"));
  const clientLocation = parseOAuthHost(clientId);
  const redirectLocation = parseOAuthHost(url.searchParams.get("redirect_uri"));

  if (!clientId) {
    return {
      state: "error",
      title: copy.errorPageTitle,
      message: copy.errorMissingClientId,
      hint: copy.errorPageHint,
    };
  }

  try {
    const client = await asOAuthProviderApi(authApi).getOAuthClientPublic({
      headers: request.headers,
      query: { client_id: clientId },
    });

    return {
      state: "consent",
      clientName: client.client_name ?? client.client_id,
      clientHost: clientLocation?.host,
      redirectHost: redirectLocation?.host,
      redirectIsLoopback: redirectLocation?.loopback ?? false,
      oauthQuery,
      scope: scopes.join(" "),
      scopes: scopes.map((scope) => ({
        value: scope,
        label: oauthScopeLabel(locals.locale, scope),
      })),
      copy: {
        title: copy.authorize,
        description: formatOAuthMessage(copy.consentDescription, {
          app: client.client_name ?? client.client_id,
        }),
        clientHostLabel: copy.clientHostLabel,
        redirectHostLabel: copy.redirectHostLabel,
        loopbackRedirectWarning: copy.loopbackRedirectWarning,
        scopesLabel: copy.scopesLabel,
        allow: copy.allow,
        deny: copy.deny,
        authorizing: copy.authorizing,
        consentFailed: copy.errorConsentFailed,
      },
    };
  } catch {
    return {
      state: "error",
      title: copy.errorPageTitle,
      message: copy.errorInvalidClient,
      hint: copy.errorPageHint,
    };
  }
};

export const oauthAuthorizeActions = {
  consent: submitOAuthConsentAction,
};
