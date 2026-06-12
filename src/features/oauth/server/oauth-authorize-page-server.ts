import type { ServerLoadEvent } from "@sveltejs/kit";
import { redirect } from "@sveltejs/kit";
import { buildSignInPageUrl } from "@/lib/auth/auth-routing";
import { asOAuthProviderApi } from "@/lib/oauth/provider-api";
import {
  formatOAuthMessage,
  getOAuthCopy,
  oauthScopeLabel,
} from "@/lib/oauth-copy";
import {
  currentOAuthAuthorizePath,
  parseOAuthScopes,
} from "./oauth-authorize-form";
import { submitOAuthConsentAction } from "./oauth-consent-action";

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

  if (!clientId) {
    return {
      state: "error",
      title: copy.errorPageTitle,
      message: copy.errorMissingClientId,
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
    };
  }
};

export const oauthAuthorizeActions = {
  consent: submitOAuthConsentAction,
};
