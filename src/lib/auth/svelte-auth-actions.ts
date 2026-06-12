import {
  DEV_ADMIN_PROVIDER_ID,
  DEV_DEBUG_PROVIDER_ID,
  resolveAuthProviderDecision,
} from "@/lib/auth/provider-ids";
import { applyAuthResponseCookies } from "@/lib/auth/svelte-auth-cookies";
import type { AuthActionInput, SignInResult } from "./svelte-auth-action-types";
import { extractResultUrl } from "./svelte-auth-action-types";
import {
  linkOidcAccount,
  linkSocialAccount,
  signInDebugProvider,
  signInOidcProvider,
  signInSocialProvider,
} from "./svelte-auth-provider-actions";

export { applyAuthResponseCookies };

export async function signInFromSvelteAction(
  input: AuthActionInput,
): Promise<SignInResult> {
  const decision = resolveAuthProviderDecision(input.providerId);
  if (decision.kind === "none") return { url: "/signin" };

  const response =
    decision.kind === "debug"
      ? await signInDebugProvider(input, decision.providerId)
      : decision.kind === "oidc"
        ? await signInOidcProvider(input, decision.providerId)
        : await signInSocialProvider(input, decision.providerId);

  applyAuthResponseCookies(response.headers, input.cookies);
  return { url: extractResultUrl(response.result, input.callbackUrl) };
}

export async function linkAccountFromSvelteAction(
  input: AuthActionInput,
): Promise<SignInResult> {
  const decision = resolveAuthProviderDecision(input.providerId);
  if (decision.kind === "none" || decision.kind === "debug") {
    throw new Error("Unsupported account link provider");
  }

  const response =
    decision.kind === "oidc"
      ? await linkOidcAccount(input, decision.providerId)
      : await linkSocialAccount(input, decision.providerId);

  applyAuthResponseCookies(response.headers, input.cookies);
  return { url: extractResultUrl(response.result, input.callbackUrl) };
}

export const DEBUG_PROVIDER_LABELS = {
  [DEV_DEBUG_PROVIDER_ID]: "Debug user",
  [DEV_ADMIN_PROVIDER_ID]: "Debug admin",
};
