import type { betterAuth } from "better-auth";
import { allowDebugAuth, getBetterAuthSecret } from "@/lib/auth/auth-config";
import {
  getAuthAllowedHosts,
  getAuthTrustedOrigins,
} from "@/lib/auth/auth-origins";
import { betterAuthApiErrorHandler } from "@/lib/auth/better-auth-api-errors";
import {
  AUTH_PUBLIC_ORIGIN,
  AUTH_PUBLIC_PROTOCOL,
  authEnv,
  OAUTH_PROXY_SECRET,
  OIDC_DISCOVERY_URL,
  OIDC_ISSUER,
} from "@/lib/auth/better-auth-option-env";
import { buildBetterAuthPlugins } from "@/lib/auth/better-auth-plugins";
import { createBetterAuthPrismaAdapter } from "@/lib/auth/better-auth-prisma-adapter";
import {
  betterAuthAccountOptions,
  betterAuthSessionOptions,
  betterAuthUserOptions,
  betterAuthVerificationOptions,
} from "@/lib/auth/better-auth-schema-options";
import { buildBetterAuthSocialProviders } from "@/lib/auth/better-auth-social-providers";
import { prisma } from "@/lib/db/prisma";

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
    socialProviders: buildBetterAuthSocialProviders(authEnv),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      autoSignIn: false,
    },
    user: betterAuthUserOptions,
    account: betterAuthAccountOptions,
    session: betterAuthSessionOptions,
    verification: betterAuthVerificationOptions,
    plugins: buildBetterAuthPlugins({
      authEnv,
      authPublicOrigin: AUTH_PUBLIC_ORIGIN,
      oauthProxySecret: OAUTH_PROXY_SECRET,
      oidcDiscoveryUrl: OIDC_DISCOVERY_URL,
      oidcIssuer: OIDC_ISSUER,
    }),
    onAPIError: betterAuthApiErrorHandler,
  } satisfies Parameters<typeof betterAuth>[0];

  return options;
}
