import type { RequestEvent } from "@sveltejs/kit";
import { redirect } from "@sveltejs/kit";
import { parseOAuthConsentForm } from "./oauth-authorize-form";

export async function submitOAuthConsentAction({
  fetch,
  request,
}: RequestEvent) {
  const form = await request.formData();
  const { accept, oauthQuery, scope } = parseOAuthConsentForm(form);
  const headers = new Headers(request.headers);
  headers.set("Content-Type", "application/json");
  headers.delete("content-length");

  let redirectTarget: string | undefined;
  try {
    const response = await fetch(
      new URL("/api/auth/oauth2/consent", request.url),
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          accept,
          scope,
          oauth_query: oauthQuery,
        }),
      },
    );
    const payload = (await response.json().catch(() => null)) as {
      redirectURI?: string;
      redirect_uri?: string;
      url?: string;
    } | null;
    redirectTarget =
      payload?.redirect_uri ?? payload?.redirectURI ?? payload?.url;
    if (!response.ok) {
      redirectTarget = undefined;
    }
  } catch {
    redirectTarget = undefined;
  }

  if (redirectTarget) {
    throw redirect(303, redirectTarget);
  }
  throw redirect(303, "/error?error=consent_failed");
}
