export type AdminCreateOAuthClientInput = {
  headers: Headers;
  body: {
    client_name: string;
    redirect_uris: string[];
    token_endpoint_auth_method: string;
    grant_types: string[];
    response_types: string[];
    scope: string;
    require_pkce: boolean;
    skip_consent: boolean;
    enable_end_session: boolean;
    metadata: Record<string, string>;
  };
};

export type AdminCreateOAuthClientResult = {
  client_id: string;
  client_secret?: string | null;
};

export type OAuthClientPublicResult = {
  client_id: string;
  client_name?: string | null;
};

export type OAuthProviderApi = {
  adminCreateOAuthClient(
    input: AdminCreateOAuthClientInput,
  ): Promise<AdminCreateOAuthClientResult>;
  getOAuthClientPublic(input: {
    headers: Headers;
    query: { client_id: string };
  }): Promise<OAuthClientPublicResult>;
};

export type OAuthProviderMetadataAuth = {
  api: {
    getOAuthServerConfig: (...args: unknown[]) => unknown;
    getOpenIdConfig: (...args: unknown[]) => unknown;
  };
};

export type GenericOAuthApi = {
  signInWithOAuth2(input: {
    body: { providerId: string; callbackURL: string };
    headers: Headers;
    returnHeaders: true;
  }): Promise<{ headers: Headers; response: unknown }>;
  oAuth2LinkAccount(input: {
    body: { providerId: string; callbackURL: string };
    headers: Headers;
    returnHeaders: true;
  }): Promise<{ headers: Headers; response: unknown }>;
};
