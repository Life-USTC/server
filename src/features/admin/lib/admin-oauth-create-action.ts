import { fail } from "@sveltejs/kit";
import type { AppLocale } from "@/i18n/config";
import { requireAdminPage } from "@/lib/admin-page-data";
import { authApi } from "@/lib/auth/core";
import { resolveOAuthClientGrantTypes } from "@/lib/oauth/client-registration";
import { OAUTH_CODE_RESPONSE_TYPE } from "@/lib/oauth/constants";
import { asOAuthProviderApi } from "@/lib/oauth/provider-api";
import {
  ADMIN_OAUTH_CLIENT_PATTERNS,
  getOAuthActionErrorMessage,
} from "./admin-oauth-action-utils";
import { parseAdminOAuthCreateRequest } from "./admin-oauth-create-request";
import { getAdminOAuthCopy } from "./admin-oauth-page-copy";

export async function createAdminOAuthClientAction(
  request: Request,
  locale: AppLocale,
) {
  const copy = getAdminOAuthCopy(locale).oauth;
  await requireAdminPage(request);
  const parsed = await parseAdminOAuthCreateRequest(request, copy);
  if ("error" in parsed) return parsed.error;
  const { name, redirectUris, scopes, tokenEndpointAuthMethod } = parsed.value;

  const clientPattern = ADMIN_OAUTH_CLIENT_PATTERNS[tokenEndpointAuthMethod];

  try {
    const result = await asOAuthProviderApi(authApi).adminCreateOAuthClient({
      headers: request.headers,
      body: {
        client_name: name,
        redirect_uris: redirectUris,
        token_endpoint_auth_method: tokenEndpointAuthMethod,
        grant_types: resolveOAuthClientGrantTypes(scopes),
        response_types: [OAUTH_CODE_RESPONSE_TYPE],
        scope: scopes.join(" "),
        require_pkce: true,
        skip_consent: clientPattern.skipConsent,
        enable_end_session: clientPattern.enableEndSession,
        metadata: {
          source: "admin_panel_svelte",
          client_pattern: clientPattern.pattern,
        },
      },
    });

    return {
      message: copy.createSuccess,
      createdClientId: result.client_id,
      createdClientSecret: result.client_secret ?? null,
      createdClientName: name,
      createdClientRedirectUris: redirectUris,
      createdClientScopes: scopes,
      createdClientTokenEndpointAuthMethod: tokenEndpointAuthMethod,
      createdClientTrusted: clientPattern.skipConsent,
    };
  } catch (error) {
    return fail(500, {
      message: getOAuthActionErrorMessage(error, copy.createError),
    });
  }
}
