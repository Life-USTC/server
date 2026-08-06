import { mcp } from "@better-auth/mcp";
import { APIError } from "better-auth/api";
import { allowDebugAuth } from "@/lib/auth/auth-config";
import { resolveOAuthUserEmail } from "@/lib/auth/oauth-user-email-resolve";
import {
  getOAuthMcpResourceUrl,
  getOAuthProviderValidAudiences,
} from "@/lib/mcp/urls";
import { hasActiveOAuthUserGrant } from "@/lib/oauth/active-user-grant";
import {
  OAUTH_EMAIL_SCOPE,
  OAUTH_GRANT_ID_CLAIM,
  OAUTH_PROFILE_SCOPE,
  OAUTH_PROVIDER_CLAIMS_SUPPORTED,
  OAUTH_PROVIDER_GRANT_TYPES,
  OAUTH_REFRESH_TOKEN_EXPIRES_IN_SECONDS,
} from "@/lib/oauth/constants";
import {
  CLIENT_REGISTRATION_ALLOWED_SCOPES,
  OAUTH_PROVIDER_SCOPES,
  PUBLIC_OAUTH_SCOPES,
} from "@/lib/oauth/scope-registry";

export function buildOAuthProviderPlugin(input: { authPublicOrigin: string }) {
  const resources = getOAuthProviderValidAudiences().map((identifier) => ({
    identifier,
    allowedScopes: [...OAUTH_PROVIDER_SCOPES],
    dpopBoundAccessTokensRequired: false,
  }));

  return mcp({
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
    resource: getOAuthMcpResourceUrl(),
    refreshTokenReuseInterval: 0,
    refreshTokenExpiresIn: OAUTH_REFRESH_TOKEN_EXPIRES_IN_SECONDS,
    clientRegistrationDefaultScopes: [...PUBLIC_OAUTH_SCOPES],
    clientRegistrationAllowedScopes: [...CLIENT_REGISTRATION_ALLOWED_SCOPES],
    resources,
    enforcePerClientResources: false,
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
      claims_supported: [...OAUTH_PROVIDER_CLAIMS_SUPPORTED],
    },
    customAccessTokenClaims({ referenceId }: { referenceId?: string }) {
      return referenceId ? { [OAUTH_GRANT_ID_CLAIM]: referenceId } : {};
    },
    async customUserInfoClaims({
      jwt,
      requestedClaims = [],
      user,
      scopes,
    }: {
      jwt: Record<string, unknown>;
      requestedClaims?: string[];
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
      if (
        scopes.includes(OAUTH_PROFILE_SCOPE) ||
        requestedClaims.includes("preferred_username")
      ) {
        const username = user.username;
        if (typeof username === "string" && username.length > 0) {
          claims.preferred_username = username;
        }
      }

      const wantsEmail =
        scopes.includes(OAUTH_EMAIL_SCOPE) ||
        requestedClaims.includes("email") ||
        requestedClaims.includes("email_verified");
      if (wantsEmail) {
        const resolved = await resolveOAuthUserEmail({
          userId: user.id,
          userEmail: typeof user.email === "string" ? user.email : null,
          userEmailVerified:
            typeof user.emailVerified === "boolean" ? user.emailVerified : null,
        });
        // Only override when we have a publishable mailbox (GitHub/Google
        // VerifiedEmail or a real User.email). Leave Better Auth's base claim
        // alone otherwise so existing OAuth clients keep current behavior for
        // USTC-only `@users.local` accounts.
        if (resolved) {
          claims.email = resolved.email;
          claims.email_verified = resolved.emailVerified;
        }
      }

      return claims;
    },
  });
}
