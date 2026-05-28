import { betterAuth } from "better-auth";
import { toNextJsHandler } from "better-auth/next-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { allowDebugAuth } from "@/lib/auth/auth-config";
import {
  buildSignInRedirectUrl,
  resolveAuthRedirectTarget,
} from "@/lib/auth/auth-routing";
import { buildBetterAuthOptions } from "@/lib/auth/better-auth-options";
import {
  ensureDebugCredentialUser,
  getDebugProviderConfig,
} from "@/lib/auth/debug-auth";
import { resolveAuthProviderDecision } from "@/lib/auth/provider-ids";
import { type AppSession, mapAppSession } from "@/lib/auth/session";
import { asGenericOAuthApi } from "@/lib/oauth/provider-api";

const authInstance = betterAuth(buildBetterAuthOptions());

export const handlers = toNextJsHandler(authInstance);
export const authApi = authInstance.api;
export const betterAuthInstance = authInstance;

export async function auth(
  source?: Request | Headers,
): Promise<AppSession | null> {
  const requestHeaders =
    source instanceof Headers
      ? source
      : source
        ? new Headers(source.headers)
        : await headers();

  const session = await authInstance.api.getSession({
    headers: requestHeaders,
  });
  if (!session) {
    return null;
  }
  return mapAppSession(session);
}

type SignInOptions = {
  redirectTo?: string;
  callbackUrl?: string;
  redirect?: boolean;
};

type SignOutOptions = {
  redirectTo?: string;
  callbackUrl?: string;
  redirect?: boolean;
};

const extractResultUrl = (result: unknown): string | null => {
  if (!result || typeof result !== "object") {
    return null;
  }
  const value = (result as { url?: unknown }).url;
  return typeof value === "string" && value.length > 0 ? value : null;
};

export async function signIn(providerId?: string, options: SignInOptions = {}) {
  const redirectTo = resolveAuthRedirectTarget(options);
  const decision = resolveAuthProviderDecision(providerId);

  if (decision.kind === "none") {
    const signInUrl = buildSignInRedirectUrl(options);
    if (options.redirect === false) {
      return { redirect: false, url: signInUrl };
    }
    redirect(signInUrl);
  }

  let result: unknown;

  switch (decision.kind) {
    case "debug": {
      if (!allowDebugAuth) {
        throw new Error("Debug auth is disabled");
      }
      await ensureDebugCredentialUser(decision.providerId);
      const debugConfig = getDebugProviderConfig(decision.providerId);
      result = await authInstance.api.signInEmail({
        body: {
          email: debugConfig.email,
          password: debugConfig.password,
          callbackURL: redirectTo,
        },
      });
      break;
    }
    case "oidc":
      result = await asGenericOAuthApi(authInstance.api).signInWithOAuth2({
        body: {
          providerId: decision.providerId,
          callbackURL: redirectTo,
        },
      });
      break;
    case "social":
      result = await authInstance.api.signInSocial({
        body: {
          provider: decision.providerId,
          callbackURL: redirectTo,
        },
      });
      break;
    default:
      throw new Error("Unsupported auth provider decision");
  }

  if (options.redirect === false) {
    return result;
  }

  redirect(extractResultUrl(result) ?? redirectTo);
}

export async function signOut(options: SignOutOptions = {}) {
  await authInstance.api.signOut({
    headers: await headers(),
  });

  const redirectTo = resolveAuthRedirectTarget(options);
  if (options.redirect === false) {
    return { success: true };
  }
  redirect(redirectTo);
}
