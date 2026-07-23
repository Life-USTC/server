import { summarizeOAuthRedirectUri } from "./oauth-debug-sanitize";

export async function tokenRequestFingerprint(
  request: Request,
): Promise<Record<string, unknown> | undefined> {
  try {
    const cloned = request.clone();
    const fd = await cloned.formData();
    const redirectUri = fd.get("redirect_uri");
    return {
      bodyParams: [...fd.keys()].sort(),
      userAgent: request.headers.get("user-agent")?.slice(0, 80) ?? null,
      origin: request.headers.get("origin") ?? null,
      contentType: request.headers.get("content-type") ?? null,
      hasResource: fd.has("resource"),
      resourceCount: fd.getAll("resource").length,
      hasCodeVerifier: fd.has("code_verifier"),
      grantType: fd.get("grant_type") ?? null,
      debugNoncePresent: request.headers.has("x-debug-nonce"),
      forwardedPresent: request.headers.has("x-forwarded-for"),
      viaPresent: request.headers.has("via"),
      ...(typeof redirectUri === "string"
        ? { redirectSummary: summarizeOAuthRedirectUri(redirectUri) }
        : {}),
    };
  } catch {
    return undefined;
  }
}

export async function tokenErrorBody(
  response: Response,
): Promise<Record<string, unknown> | undefined> {
  try {
    const cloned = response.clone();
    const json = await cloned.json();
    return {
      error: json.error,
      errorDescriptionPresent: Boolean(json.error_description),
    };
  } catch {
    return undefined;
  }
}
