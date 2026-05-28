type AdminCreateOAuthClientInput = {
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

type AdminCreateOAuthClientResult = {
  client_id: string;
  client_secret?: string | null;
};

type OAuthClientPublicResult = {
  client_id: string;
  client_name?: string | null;
};

type OAuthProviderApi = {
  adminCreateOAuthClient(
    input: AdminCreateOAuthClientInput,
  ): Promise<AdminCreateOAuthClientResult>;
  getOAuthClientPublic(input: {
    headers: Headers;
    query: { client_id: string };
  }): Promise<OAuthClientPublicResult>;
};

type OAuthProviderMetadataAuth = {
  api: {
    getOAuthServerConfig: (...args: unknown[]) => unknown;
    getOpenIdConfig: (...args: unknown[]) => unknown;
  };
};

type GenericOAuthApi = {
  signInWithOAuth2(input: {
    body: { providerId: string; callbackURL: string };
  }): Promise<unknown>;
};

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (value && typeof value === "object")
    return value as Record<string, unknown>;
  throw new Error(message);
}

function requireMethod<TArgs extends unknown[], TReturn>(
  target: Record<string, unknown>,
  label: string,
  method: string,
): (...args: TArgs) => TReturn {
  const fn = target[method];
  if (typeof fn !== "function")
    throw new Error(`${label} is unavailable: missing ${method}()`);
  return fn.bind(target) as (...args: TArgs) => TReturn;
}

export function asOAuthProviderApi(api: unknown): OAuthProviderApi {
  const record = asRecord(
    api,
    "Better Auth OAuth provider API is unavailable: expected an object API surface",
  );
  return {
    adminCreateOAuthClient: requireMethod(
      record,
      "Better Auth OAuth provider API",
      "adminCreateOAuthClient",
    ),
    getOAuthClientPublic: requireMethod(
      record,
      "Better Auth OAuth provider API",
      "getOAuthClientPublic",
    ),
  };
}

export function asOAuthProviderMetadataAuth(
  auth: unknown,
): OAuthProviderMetadataAuth {
  const authRecord = asRecord(
    auth,
    "Better Auth OAuth metadata API is unavailable: expected an auth instance object",
  );
  const apiRecord = asRecord(
    authRecord.api,
    "Better Auth OAuth metadata API is unavailable: missing auth.api object",
  );
  return {
    api: {
      getOAuthServerConfig: requireMethod(
        apiRecord,
        "Better Auth OAuth metadata API",
        "getOAuthServerConfig",
      ),
      getOpenIdConfig: requireMethod(
        apiRecord,
        "Better Auth OAuth metadata API",
        "getOpenIdConfig",
      ),
    },
  };
}

export function asGenericOAuthApi(api: unknown): GenericOAuthApi {
  const record = asRecord(
    api,
    "Better Auth generic OAuth API is unavailable: expected an object API surface",
  );
  return {
    signInWithOAuth2: requireMethod(
      record,
      "Better Auth generic OAuth API",
      "signInWithOAuth2",
    ),
  };
}
