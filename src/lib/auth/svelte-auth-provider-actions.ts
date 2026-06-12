import { asGenericOAuthApi } from "@/lib/oauth/provider-api";
import type { DebugProviderId } from "./provider-ids";
import type {
  AuthActionInput,
  AuthActionResponse,
  GenericOAuthWithHeaders,
  SocialLinkWithHeaders,
} from "./svelte-auth-action-types";

export async function signInDebugProvider(
  input: AuthActionInput,
  providerId: DebugProviderId,
): Promise<AuthActionResponse> {
  const { allowDebugAuth } = await import("@/lib/auth/auth-config");
  if (!allowDebugAuth) throw new Error("Debug auth is disabled");

  const { authApi } = await import("@/lib/auth/core");
  const { ensureDebugCredentialUser, getDebugProviderConfig } = await import(
    "@/lib/auth/debug-auth"
  );
  await ensureDebugCredentialUser(providerId);
  const debugConfig = getDebugProviderConfig(providerId);
  const response = await authApi.signInEmail({
    body: {
      email: debugConfig.email,
      password: debugConfig.password,
      callbackURL: input.callbackUrl,
    },
    headers: input.headers,
    returnHeaders: true,
  });
  return { headers: response.headers, result: response.response };
}

export async function signInOidcProvider(
  input: AuthActionInput,
  providerId: string,
): Promise<AuthActionResponse> {
  const { betterAuthInstance } = await import("@/lib/auth/core");
  const genericOAuthApi = asGenericOAuthApi(
    betterAuthInstance.api,
  ) as unknown as GenericOAuthWithHeaders;
  const response = await genericOAuthApi.signInWithOAuth2({
    body: {
      providerId,
      callbackURL: input.callbackUrl,
    },
    headers: input.headers,
    returnHeaders: true,
  });
  return { headers: response.headers, result: response.response };
}

export async function signInSocialProvider(
  input: AuthActionInput,
  providerId: string,
): Promise<AuthActionResponse> {
  const { authApi } = await import("@/lib/auth/core");
  const response = await authApi.signInSocial({
    body: {
      provider: providerId,
      callbackURL: input.callbackUrl,
    },
    headers: input.headers,
    returnHeaders: true,
  });
  return { headers: response.headers, result: response.response };
}

export async function linkOidcAccount(
  input: AuthActionInput,
  providerId: string,
): Promise<AuthActionResponse> {
  const { betterAuthInstance } = await import("@/lib/auth/core");
  const genericOAuthApi = asGenericOAuthApi(
    betterAuthInstance.api,
  ) as unknown as GenericOAuthWithHeaders;
  const response = await genericOAuthApi.oAuth2LinkAccount({
    body: {
      providerId,
      callbackURL: input.callbackUrl,
    },
    headers: input.headers,
    returnHeaders: true,
  });
  return { headers: response.headers, result: response.response };
}

export async function linkSocialAccount(
  input: AuthActionInput,
  providerId: string,
): Promise<AuthActionResponse> {
  const { authApi } = await import("@/lib/auth/core");
  const socialApi = authApi as unknown as SocialLinkWithHeaders;
  const response = await socialApi.linkSocialAccount({
    body: {
      provider: providerId,
      callbackURL: input.callbackUrl,
      disableRedirect: true,
    },
    headers: input.headers,
    returnHeaders: true,
  });
  return { headers: response.headers, result: response.response };
}
