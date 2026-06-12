import { asRecord, requireMethod } from "@/lib/oauth/provider-api-guards";
import type {
  GenericOAuthApi,
  OAuthProviderApi,
  OAuthProviderMetadataAuth,
} from "@/lib/oauth/provider-api-types";

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
    oAuth2LinkAccount: requireMethod(
      record,
      "Better Auth generic OAuth API",
      "oAuth2LinkAccount",
    ),
  };
}
