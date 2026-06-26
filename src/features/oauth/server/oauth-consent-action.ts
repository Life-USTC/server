import { redirect } from "@sveltejs/kit";
import { asOAuthProviderApi } from "@/lib/oauth/provider-api";
import { parseOAuthConsentForm } from "./oauth-authorize-form";

export async function submitOAuthConsentAction({
  request,
}: {
  request: Request;
}) {
  const form = await request.formData();
  const { accept, oauthQuery, scope } = parseOAuthConsentForm(form);
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  headers.set("accept", "application/json");

  let redirectTarget: string | undefined;
  try {
    const { authApi } = await import("@/lib/auth/core");
    const consentUrl = new URL("/api/auth/oauth2/consent", request.url);
    const payload = await asOAuthProviderApi(authApi).oauth2Consent({
      asResponse: false,
      headers,
      request: new Request(consentUrl, {
        method: "POST",
        headers,
      }),
      body: {
        accept,
        scope,
        oauth_query: oauthQuery,
      },
    });
    redirectTarget =
      payload?.redirect_uri ?? payload?.redirectURI ?? payload?.url;
  } catch {
    redirectTarget = undefined;
  }

  if (redirectTarget) {
    throw redirect(303, redirectTarget);
  }
  throw redirect(303, "/error?error=consent_failed");
}
