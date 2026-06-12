export function oauthClientTypeLabel(
  method: string,
  copy: Record<string, string>,
) {
  if (method === "none") return copy.clientTypePublic;
  if (method === "client_secret_post") return copy.clientTypeConfidentialPost;
  return copy.clientTypeConfidentialBasic;
}

export function oauthClientAuthCopy(
  method: string,
  copy: Record<string, string>,
) {
  if (method === "none") return copy.clientTypePublicDescription;
  if (method === "client_secret_post") return copy.clientTypePostDescription;
  return copy.clientTypeBasicDescription;
}

export function oauthScopeLabel(scope: string, copy: Record<string, string>) {
  return copy[`scope_${scope}`] ?? scope;
}

export function oauthCopyValue(key: string, copy: Record<string, string>) {
  return copy[key] ?? key;
}

export function oauthRedirectCountLabel(count: number, locale: string) {
  if (locale === "zh-cn") {
    return count === 0 ? "尚未填写重定向 URI" : `${count} 个重定向 URI`;
  }
  if (count === 0) return "No redirect URIs yet";
  return count === 1 ? "1 redirect URI" : `${count} redirect URIs`;
}

export function oauthScopeCountLabel(count: number, locale: string) {
  if (locale === "zh-cn") {
    return count === 0 ? "尚未选择权限" : `已选择 ${count} 个权限`;
  }
  if (count === 0) return "No scopes selected";
  return count === 1 ? "1 scope selected" : `${count} scopes selected`;
}

export function toggleOAuthScope(
  selectedScopes: string[],
  scope: string,
  checked: boolean,
) {
  return checked
    ? Array.from(new Set([...selectedScopes, scope]))
    : selectedScopes.filter((selectedScope) => selectedScope !== scope);
}

export function createdOAuthCredentialsJson(form: {
  createdClientId?: string | null;
  createdClientRedirectUris?: string[] | null;
  createdClientScopes?: string[] | null;
  createdClientSecret?: string | null;
  createdClientTokenEndpointAuthMethod?: string | null;
}) {
  if (!form.createdClientId) return "";
  return JSON.stringify(
    {
      client_id: form.createdClientId,
      client_secret: form.createdClientSecret ?? null,
      redirect_uris: form.createdClientRedirectUris ?? [],
      token_endpoint_auth_method:
        form.createdClientTokenEndpointAuthMethod ?? "client_secret_basic",
      scopes: form.createdClientScopes ?? [],
    },
    null,
    2,
  );
}
