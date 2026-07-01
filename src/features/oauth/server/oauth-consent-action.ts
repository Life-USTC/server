import { error, redirect } from "@sveltejs/kit";
import { isTrustedAuthOrigin } from "@/lib/auth/auth-origins";
import { asOAuthProviderApi } from "@/lib/oauth/provider-api";
import { parseOAuthConsentForm } from "./oauth-authorize-form";

function assertTrustedCookieRequestOrigin(request: Request) {
  const headers = request.headers;
  if (!headers.has("cookie")) return;

  const origin = headers.get("origin") || headers.get("referer");
  if (!origin || origin === "null" || !isTrustedAuthOrigin(origin)) {
    throw error(403, "Invalid origin");
  }
}

export async function submitOAuthConsentAction({
  request,
}: {
  request: Request;
}) {
  assertTrustedCookieRequestOrigin(request);

  const form = await request.formData();
  const { accept, oauthQuery, scope } = parseOAuthConsentForm(form);
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  headers.set("accept", "application/json");
  headers.set("content-type", "application/json");

  let redirectTarget: string | undefined;
  try {
    const authCore = await import("@/lib/auth/core");
    const authApi = authCore.authApi;
    const betterAuthInstance = Object.hasOwn(authCore, "betterAuthInstance")
      ? authCore.betterAuthInstance
      : undefined;
    const consentUrl = new URL("/api/auth/oauth2/consent", request.url);
    const body = {
      accept,
      scope,
      oauth_query: oauthQuery,
    };
    try {
      if (typeof betterAuthInstance?.handler === "function") {
        const response = await betterAuthInstance.handler(
          new Request(consentUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
          }),
        );
        const payload = (await response
          .clone()
          .json()
          .catch(() => null)) as {
          redirect_uri?: string;
          redirectURI?: string;
          url?: string;
        } | null;
        redirectTarget =
          response.headers.get("location") ??
          payload?.redirect_uri ??
          payload?.redirectURI ??
          payload?.url;
      }
    } catch {
      redirectTarget = undefined;
    }
    if (!redirectTarget) {
      const payload = await asOAuthProviderApi(authApi).oauth2Consent({
        asResponse: false,
        headers,
        request: new Request(consentUrl, {
          method: "POST",
          headers,
        }),
        body,
      });
      redirectTarget =
        payload?.redirect_uri ?? payload?.redirectURI ?? payload?.url;
    }
  } catch {
    redirectTarget = undefined;
  }

  if (redirectTarget) {
    throw redirect(303, redirectTarget);
  }
  throw redirect(303, "/error?error=consent_failed");
}
