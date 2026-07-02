import { error, redirect } from "@sveltejs/kit";
import { isTrustedAuthOrigin } from "@/lib/auth/auth-origins";
import { asOAuthProviderApi } from "@/lib/oauth/provider-api";
import { parseOAuthConsentForm } from "./oauth-authorize-form";

const OAUTH_SIGNED_QUERY_KEYS = new Set(["sig", "exp", "ba_iat", "ba_pl"]);

type OAuthAuthorizeApi = {
  oauth2Authorize(input: {
    asResponse?: false;
    headers: Headers;
    request: Request;
    query: Record<string, string>;
  }): Promise<{
    redirect_uri?: string;
    redirectURI?: string;
    url?: string;
  }>;
};

function assertTrustedCookieRequestOrigin(request: Request) {
  const headers = request.headers;
  if (!headers.has("cookie")) return;

  const origin = headers.get("origin") || headers.get("referer");
  if (!origin || origin === "null" || !isTrustedAuthOrigin(origin)) {
    throw error(403, "Invalid origin");
  }
}

function redirectPayloadTarget(payload: {
  redirect_uri?: string;
  redirectURI?: string;
  url?: string;
}) {
  return payload.redirect_uri ?? payload.redirectURI ?? payload.url;
}

function asOAuthAuthorizeApi(api: unknown): OAuthAuthorizeApi | null {
  if (!api || typeof api !== "object") return null;
  const authorize = (api as { oauth2Authorize?: unknown }).oauth2Authorize;
  if (typeof authorize !== "function") return null;
  return {
    oauth2Authorize: authorize.bind(
      api,
    ) as OAuthAuthorizeApi["oauth2Authorize"],
  };
}

function isOAuthAuthorizePageRedirect(target: string, requestUrl: string) {
  try {
    const url = new URL(target, requestUrl);
    const requestOrigin = new URL(requestUrl).origin;
    return url.origin === requestOrigin && url.pathname === "/oauth/authorize";
  } catch {
    return false;
  }
}

function oauthAuthorizeQueryFromRedirect(target: string, requestUrl: string) {
  const url = new URL(target, requestUrl);
  for (const key of OAUTH_SIGNED_QUERY_KEYS) {
    url.searchParams.delete(key);
  }
  return Object.fromEntries(url.searchParams.entries());
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
    const consentUrl = new URL("/api/auth/oauth2/consent", request.url);
    const body = {
      accept,
      scope,
      oauth_query: oauthQuery,
    };
    const payload = await asOAuthProviderApi(authApi).oauth2Consent({
      asResponse: false,
      headers,
      request: new Request(consentUrl, {
        method: "POST",
        headers,
      }),
      body,
    });
    redirectTarget = redirectPayloadTarget(payload);
    if (
      redirectTarget &&
      isOAuthAuthorizePageRedirect(redirectTarget, request.url)
    ) {
      const authorizeApi = asOAuthAuthorizeApi(authApi);
      const authorizeQuery = oauthAuthorizeQueryFromRedirect(
        redirectTarget,
        request.url,
      );
      const authorizeUrl = new URL("/api/auth/oauth2/authorize", request.url);
      authorizeUrl.search = new URLSearchParams(authorizeQuery).toString();
      const authorizePayload = await authorizeApi?.oauth2Authorize({
        asResponse: false,
        headers,
        request: new Request(authorizeUrl, {
          method: "GET",
          headers,
        }),
        query: authorizeQuery,
      });
      redirectTarget = authorizePayload
        ? redirectPayloadTarget(authorizePayload)
        : undefined;
    }
  } catch {
    redirectTarget = undefined;
  }

  if (redirectTarget) {
    throw redirect(303, redirectTarget);
  }
  throw redirect(303, "/error?error=consent_failed");
}
