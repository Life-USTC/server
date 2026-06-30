import { oauthProvider } from "@better-auth/oauth-provider";
import { allowDebugAuth } from "@/lib/auth/auth-config";
import { getOAuthProviderValidAudiences } from "@/lib/mcp/urls";
import {
  DEFAULT_OAUTH_CLIENT_SCOPES,
  OAUTH_PROFILE_SCOPE,
  OAUTH_PROVIDER_GRANT_TYPES,
} from "@/lib/oauth/constants";
import { OAUTH_SCOPES } from "@/lib/oauth/scope-registry";

export function buildOAuthProviderPlugin(input: { authPublicOrigin: string }) {
  return oauthProvider({
    // Absolute URLs so redirects stay correct behind Docker/Caddy.
    loginPage: `${input.authPublicOrigin}/signin`,
    consentPage: `${input.authPublicOrigin}/oauth/authorize`,
    allowDynamicClientRegistration: true,
    allowUnauthenticatedClientRegistration: true,
    rateLimit: allowDebugAuth()
      ? {
          register: false,
        }
      : undefined,
    scopes: [...OAUTH_SCOPES],
    grantTypes: [...OAUTH_PROVIDER_GRANT_TYPES],
    clientRegistrationDefaultScopes: [...DEFAULT_OAUTH_CLIENT_SCOPES],
    clientRegistrationAllowedScopes: [...OAUTH_SCOPES],
    validAudiences: getOAuthProviderValidAudiences(),
    silenceWarnings: {
      oauthAuthServerConfig: true,
      openidConfig: true,
    },
    schema: {
      oauthClient: {
        modelName: "OAuthClient",
      },
      oauthAccessToken: {
        modelName: "OAuthAccessToken",
      },
      oauthRefreshToken: {
        modelName: "OAuthRefreshToken",
      },
      oauthConsent: {
        modelName: "OAuthConsent",
      },
    },
    advertisedMetadata: {
      scopes_supported: [...OAUTH_SCOPES],
      claims_supported: [
        "sub",
        "name",
        "preferred_username",
        "picture",
        "email",
        "email_verified",
      ],
    },
    customUserInfoClaims({
      user,
      scopes,
    }: {
      user: Record<string, unknown>;
      scopes: string[];
    }) {
      const claims: Record<string, unknown> = {};
      if (scopes.includes(OAUTH_PROFILE_SCOPE)) {
        const username = user.username;
        if (typeof username === "string" && username.length > 0) {
          claims.preferred_username = username;
        }
      }
      return claims;
    },
  });
}
