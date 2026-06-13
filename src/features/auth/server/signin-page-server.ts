import { type Cookies, fail, redirect } from "@sveltejs/kit";
import { allowDebugAuth } from "@/lib/auth/auth-config";
import { resolveSignInCallbackUrl } from "@/lib/auth/auth-routing";
import {
  DEV_ADMIN_PROVIDER_ID,
  DEV_DEBUG_PROVIDER_ID,
  getSignInProviderIds,
} from "@/lib/auth/provider-ids";
import { hasRequestAuthSignal } from "@/lib/auth/request-auth-signal";
import { signInFromSvelteAction } from "@/lib/auth/svelte-auth-actions";
import {
  parseTermsNotice,
  providerNames,
  signInMessages,
  signInWith,
} from "./signin-page-copy";

function searchParamsObject(url: URL) {
  return Object.fromEntries(url.searchParams.entries());
}

export async function loadSignInPage({
  locals,
  request,
  url,
}: {
  locals: App.Locals;
  request: Request;
  url: URL;
}) {
  const callbackUrl = resolveSignInCallbackUrl(searchParamsObject(url));
  const session = hasRequestAuthSignal(request.headers)
    ? await import("@/lib/auth/core").then(({ getSessionFromHeaders }) =>
        getSessionFromHeaders(request.headers),
      )
    : null;
  if (session?.user) {
    throw redirect(303, callbackUrl);
  }

  const copy = signInMessages[locals.locale];
  const names = providerNames(locals.locale);
  return {
    callbackUrl,
    error: url.searchParams.get("error"),
    providers: getSignInProviderIds(allowDebugAuth).map((id) => ({
      id,
      name: names[id],
      label: signInWith(copy.signInWith, names[id]),
      debug: id === DEV_DEBUG_PROVIDER_ID || id === DEV_ADMIN_PROVIDER_ID,
    })),
    copy: {
      title: copy.title,
      description: copy.description,
      devDebugHint: allowDebugAuth ? copy.devDebugHint : "",
      errorAccountNotLinked: copy.errorAccountNotLinked,
      errorGeneric: copy.errorGeneric,
      termsNotice: parseTermsNotice(copy.termsNotice),
    },
    showDebugProviders: allowDebugAuth,
  };
}

export async function signInPageDefaultAction({
  cookies,
  locals,
  request,
}: {
  cookies: Cookies;
  locals: App.Locals;
  request: Request;
}) {
  const form = await request.formData();
  const providerId = String(form.get("providerId") ?? "");
  const callbackUrl = String(form.get("callbackUrl") ?? "/") || "/";
  try {
    const result = await signInFromSvelteAction({
      providerId,
      callbackUrl,
      headers: request.headers,
      cookies,
    });
    throw redirect(303, result.url);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      "location" in error
    ) {
      throw error;
    }
    return fail(400, {
      message: signInMessages[locals.locale].errorGeneric,
    });
  }
}
