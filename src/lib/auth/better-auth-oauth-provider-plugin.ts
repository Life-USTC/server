import { oauthProvider } from "@better-auth/oauth-provider";
import { APIError } from "better-auth/api";
import { allowDebugAuth } from "@/lib/auth/auth-config";
import { getOAuthProviderValidAudiences } from "@/lib/mcp/urls";
import { hasActiveOAuthUserGrant } from "@/lib/oauth/active-user-grant";
import {
  OAUTH_GRANT_ID_CLAIM,
  OAUTH_PROFILE_SCOPE,
  OAUTH_PROVIDER_GRANT_TYPES,
  OAUTH_REFRESH_TOKEN_EXPIRES_IN_SECONDS,
} from "@/lib/oauth/constants";
import {
  CLIENT_REGISTRATION_ALLOWED_SCOPES,
  OAUTH_PROVIDER_SCOPES,
  PUBLIC_OAUTH_SCOPES,
} from "@/lib/oauth/scope-registry";

export function buildOAuthProviderPlugin(input: { authPublicOrigin: string }) {
  return oauthProvider({
    // Absolute URLs so redirects stay correct behind Docker/Caddy.
    loginPage: `${input.authPublicOrigin}/account/sign-in`,
    consentPage: `${input.authPublicOrigin}/oauth/authorize`,
    allowDynamicClientRegistration: true,
    allowUnauthenticatedClientRegistration: true,
    rateLimit: allowDebugAuth()
      ? {
          register: false,
        }
      : undefined,
    scopes: [...OAUTH_PROVIDER_SCOPES],
    grantTypes: [...OAUTH_PROVIDER_GRANT_TYPES],
    refreshTokenExpiresIn: OAUTH_REFRESH_TOKEN_EXPIRES_IN_SECONDS,
    clientRegistrationDefaultScopes: [...PUBLIC_OAUTH_SCOPES],
    clientRegistrationAllowedScopes: [...CLIENT_REGISTRATION_ALLOWED_SCOPES],
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
      scopes_supported: [...PUBLIC_OAUTH_SCOPES],
      claims_supported: [
        "sub",
        "name",
        "preferred_username",
        "picture",
        "email",
        "email_verified",
      ],
    },
    customAccessTokenClaims({ referenceId }: { referenceId?: string }) {
      return referenceId ? { [OAUTH_GRANT_ID_CLAIM]: referenceId } : {};
    },
    async customUserInfoClaims({
      jwt,
      user,
      scopes,
    }: {
      jwt: Record<string, unknown>;
      user: Record<string, unknown>;
      scopes: string[];
    }) {
      const clientId =
        typeof jwt.azp === "string"
          ? jwt.azp
          : typeof jwt.client_id === "string"
            ? jwt.client_id
            : null;
      if (
        !clientId ||
        typeof user.id !== "string" ||
        !(await hasActiveOAuthUserGrant({
          clientId,
          grantId:
            typeof jwt[OAUTH_GRANT_ID_CLAIM] === "string"
              ? jwt[OAUTH_GRANT_ID_CLAIM]
              : undefined,
          requireGrantBinding: true,
          scopes,
          userId: user.id,
        }))
      ) {
        throw new APIError("UNAUTHORIZED", {
          error: "invalid_token",
          error_description: "OAuth authorization is no longer active",
        });
      }

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
