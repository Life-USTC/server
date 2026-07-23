import type { betterAuth } from "better-auth";
import { allowDebugAuth, getBetterAuthSecret } from "@/lib/auth/auth-config";
import {
  getAuthAllowedHosts,
  getAuthTrustedOrigins,
} from "@/lib/auth/auth-origins";
import { betterAuthApiErrorHandler } from "@/lib/auth/better-auth-api-errors";
import { getBetterAuthOptionEnv } from "@/lib/auth/better-auth-option-env";
import { betterAuthPasskeyRateLimitRules } from "@/lib/auth/better-auth-passkey-plugin";
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
  const {
    authEnv,
    authPublicOrigin,
    authPublicProtocol,
    oauthProxySecret,
    oidcDiscoveryUrl,
    oidcIssuer,
  } = getBetterAuthOptionEnv();
  const debugAuthAllowed = allowDebugAuth();
  const options = {
    baseURL: {
      allowedHosts: getAuthAllowedHosts(),
      fallback: authPublicOrigin,
      protocol: authPublicProtocol,
    },
    secret: getBetterAuthSecret(),
    database: createBetterAuthPrismaAdapter(prisma),
    disabledPaths: ["/token"],
    // Disable Better Auth's built-in rate limiting in debug/E2E mode so that
    // rapid sequential requests (e.g. /api/auth/get-session during tests)
    // don't get throttled with 429 responses.
    rateLimit: debugAuthAllowed
      ? { enabled: false }
      : { enabled: true, customRules: betterAuthPasskeyRateLimitRules },
    advanced: {
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip"],
      },
      // Reverse proxies should still forward the original scheme/host correctly
      // for request-aware Better Auth behavior, but deployment origin comes from config.
      trustedProxyHeaders: true,
      // Better Auth otherwise skips origin checks automatically under NODE_ENV=test.
      // Keep passkey and other cookie-backed auth routes on the production boundary.
      disableCSRFCheck: false,
      disableOriginCheck: false,
    },
    trustedOrigins: getAuthTrustedOrigins(),
    socialProviders: buildBetterAuthSocialProviders(authEnv),
    emailAndPassword: {
      enabled: debugAuthAllowed,
      disableSignUp: true,
      autoSignIn: false,
    },
    user: betterAuthUserOptions,
    account: betterAuthAccountOptions,
    session: betterAuthSessionOptions,
    verification: betterAuthVerificationOptions,
    plugins: buildBetterAuthPlugins({
      authEnv,
      authPublicOrigin,
      oauthProxySecret,
      oidcDiscoveryUrl,
      oidcIssuer,
    }),
    onAPIError: betterAuthApiErrorHandler,
  } satisfies Parameters<typeof betterAuth>[0];

  return options;
}
