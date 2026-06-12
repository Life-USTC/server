import { fail } from "@sveltejs/kit";
import { resolveOAuthClientScopes } from "@/lib/oauth/client-registration";
import {
  isSupportedOAuthClientAuthMethod,
  OAUTH_CLIENT_SECRET_BASIC_AUTH_METHOD,
  type SupportedOAuthClientAuthMethod,
} from "@/lib/oauth/constants";
import { parseFormLines } from "./admin-oauth-action-utils";

export async function parseAdminOAuthCreateRequest(
  request: Request,
  copy: {
    clientNameRequired: string;
    redirectUrisRequired: string;
    unsupportedAuthMethod: string;
  },
) {
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const redirectUris = parseFormLines(form.get("redirectUris"));
  const tokenEndpointAuthMethod =
    String(form.get("tokenEndpointAuthMethod") ?? "") ||
    OAUTH_CLIENT_SECRET_BASIC_AUTH_METHOD;
  const scopesResult = resolveOAuthClientScopes(
    form.getAll("scopes").map(String).filter(Boolean),
  );
  if (!name) return { error: fail(400, { message: copy.clientNameRequired }) };
  if (!isSupportedOAuthClientAuthMethod(tokenEndpointAuthMethod)) {
    return { error: fail(400, { message: copy.unsupportedAuthMethod }) };
  }
  if (redirectUris.length === 0) {
    return { error: fail(400, { message: copy.redirectUrisRequired }) };
  }
  if ("error" in scopesResult) {
    return { error: fail(400, { message: scopesResult.error }) };
  }

  return {
    value: {
      name,
      redirectUris,
      scopes: scopesResult.scopes,
      tokenEndpointAuthMethod:
        tokenEndpointAuthMethod as SupportedOAuthClientAuthMethod,
    },
  };
}
