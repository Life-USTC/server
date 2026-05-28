import { oauthProvider } from "@better-auth/oauth-provider";
import type { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { genericOAuth, jwt, oAuthProxy } from "better-auth/plugins";
import { getAuthEnv } from "@/env";
import {
  allowDebugAuth,
  getBetterAuthSecret,
  isDevelopment,
} from "@/lib/auth/auth-config";
import {
  getAuthAllowedHosts,
  getAuthTrustedOrigins,
} from "@/lib/auth/auth-origins";
import { createBetterAuthPrismaAdapter } from "@/lib/auth/better-auth-prisma-adapter";
import {
  mapGithubProfileToUser,
  mapGoogleProfileToUser,
  mapOidcProfileToUser,
} from "@/lib/auth/oauth-profile";
import { webhookLoginPlugin } from "@/lib/auth/webhook-login-plugin";
import { prisma } from "@/lib/db/prisma";
import { logAppEvent } from "@/lib/log/app-logger";
import { isOAuthDebugLogging, logOAuthDebug } from "@/lib/log/oauth-debug";
import {
  getCanonicalOAuthIssuer,
  getOAuthProviderValidAudiences,
} from "@/lib/mcp/urls";
import {
  OAUTH_OPENID_SCOPE,
  OAUTH_PROFILE_SCOPE,
  OAUTH_PROVIDER_SCOPES,
} from "@/lib/oauth/constants";
import { getCanonicalOrigin, getPublicOrigin } from "@/lib/site-url";

const authEnv = getAuthEnv();
const AUTH_PUBLIC_ORIGIN = getPublicOrigin();
const AUTH_PUBLIC_PROTOCOL = getAuthPublicProtocol(AUTH_PUBLIC_ORIGIN);
const OAUTH_PROXY_SECRET = authEnv.OAUTH_PROXY_SECRET;
const OIDC_ISSUER =
  authEnv.AUTH_OIDC_ISSUER ?? "https://sso-proxy.lug.ustc.edu.cn/auth/oauth2";
const OIDC_DISCOVERY_URL = `${OIDC_ISSUER.replace(/\/$/, "")}/.well-known/openid-configuration`;
const AUTH_GITHUB = getProviderCredentials(
  authEnv.AUTH_GITHUB_ID,
  authEnv.AUTH_GITHUB_SECRET,
);
const AUTH_GOOGLE = getProviderCredentials(
  authEnv.AUTH_GOOGLE_ID,
  authEnv.AUTH_GOOGLE_SECRET,
);

function getAuthPublicProtocol(origin: string): "http" | "https" {
  const protocol = new URL(origin).protocol;
  if (protocol === "http:" || protocol === "https:") {
    return protocol.slice(0, -1) as "http" | "https";
  }
  throw new Error(`Unsupported auth origin protocol: ${protocol}`);
}

function getProviderCredentials(
  clientId: string | undefined,
  clientSecret: string | undefined,
) {
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function buildBetterAuthOptions() {
  const options = {
    baseURL: {
      allowedHosts: getAuthAllowedHosts(),
      fallback: AUTH_PUBLIC_ORIGIN,
      protocol: AUTH_PUBLIC_PROTOCOL,
    },
    secret: getBetterAuthSecret(),
    database: createBetterAuthPrismaAdapter(prisma),
    disabledPaths: ["/token"],
    // Disable Better Auth's built-in rate limiting in debug/E2E mode so that
    // rapid sequential requests (e.g. /api/auth/get-session during tests)
    // don't get throttled with 429 responses.
    ...(allowDebugAuth ? { rateLimit: { enabled: false } } : {}),
    advanced: {
      // Reverse proxies should still forward the original scheme/host correctly
      // for request-aware Better Auth behavior, but deployment origin comes from config.
      trustedProxyHeaders: true,
    },
    trustedOrigins: getAuthTrustedOrigins(),
    socialProviders: {
      ...(AUTH_GITHUB
        ? {
            github: {
              clientId: AUTH_GITHUB.clientId,
              clientSecret: AUTH_GITHUB.clientSecret,
              mapProfileToUser: mapGithubProfileToUser,
            },
          }
        : {}),
      ...(AUTH_GOOGLE
        ? {
            google: {
              clientId: AUTH_GOOGLE.clientId,
              clientSecret: AUTH_GOOGLE.clientSecret,
              mapProfileToUser: mapGoogleProfileToUser,
            },
          }
        : {}),
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      autoSignIn: false,
    },
    user: {
      additionalFields: {
        username: {
          type: "string",
          required: false,
        },
        isAdmin: {
          type: "boolean",
          defaultValue: false,
        },
        profilePictures: {
          type: "string[]",
          required: false,
          defaultValue: [],
        },
      },
    },
    account: {
      accountLinking: {
        enabled: true,
        // User-initiated linking must support providers like USTC OIDC that do
        // not expose the user's email and therefore use a local fallback email.
        allowDifferentEmails: true,
      },
      fields: {
        providerId: "provider",
        accountId: "providerAccountId",
        accessToken: "access_token",
        refreshToken: "refresh_token",
        idToken: "id_token",
        scope: "scope",
        accessTokenExpiresAt: "accessTokenExpiresAt",
        refreshTokenExpiresAt: "refreshTokenExpiresAt",
        password: "password",
      },
    },
    session: {
      storeSessionInDatabase: true,
      fields: {
        token: "sessionToken",
        expiresAt: "expires",
        ipAddress: "ipAddress",
        userAgent: "userAgent",
      },
    },
    verification: {
      modelName: "verificationToken",
      fields: {
        value: "token",
        expiresAt: "expires",
      },
    },
    plugins: [
      jwt({
        jwt: {
          issuer: getCanonicalOAuthIssuer(),
        },
        schema: {
          jwks: {
            modelName: "Jwks",
          },
        },
      }),
      oAuthProxy({
        productionURL: getCanonicalOrigin(),
        currentURL: AUTH_PUBLIC_ORIGIN,
        ...(OAUTH_PROXY_SECRET ? { secret: OAUTH_PROXY_SECRET } : {}),
      }),
      webhookLoginPlugin(),
      oauthProvider({
        // Absolute URLs so redirects stay correct behind Docker/Caddy.
        loginPage: `${AUTH_PUBLIC_ORIGIN}/signin`,
        consentPage: `${AUTH_PUBLIC_ORIGIN}/oauth/authorize`,
        allowDynamicClientRegistration: true,
        allowUnauthenticatedClientRegistration: true,
        rateLimit: allowDebugAuth
          ? {
              register: false,
            }
          : undefined,
        scopes: [...OAUTH_PROVIDER_SCOPES],
        clientRegistrationDefaultScopes: [...OAUTH_PROVIDER_SCOPES],
        clientRegistrationAllowedScopes: [...OAUTH_PROVIDER_SCOPES],
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
          scopes_supported: [...OAUTH_PROVIDER_SCOPES],
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
      }),
      genericOAuth({
        config: [
          {
            providerId: "oidc",
            discoveryUrl: OIDC_DISCOVERY_URL,
            issuer: OIDC_ISSUER,
            clientId: authEnv.AUTH_OIDC_CLIENT_ID ?? "",
            clientSecret: authEnv.AUTH_OIDC_CLIENT_SECRET ?? "",
            scopes: [OAUTH_OPENID_SCOPE],
            pkce: true,
            mapProfileToUser: mapOidcProfileToUser,
          },
        ],
      }),
      nextCookies(),
    ],
    onAPIError: {
      onError(error: unknown) {
        if (isDevelopment) {
          logAppEvent(
            "error",
            "Better Auth API error",
            { source: "auth", event: "better-auth.api-error" },
            error,
          );
        }
        if (isOAuthDebugLogging()) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          const errorName = error instanceof Error ? error.name : "unknown";
          logOAuthDebug("better-auth.api-error", undefined, {
            message: errorMessage,
            name: errorName,
          });
        }
      },
    },
  } satisfies Parameters<typeof betterAuth>[0];

  return options;
}
