import { error, redirect } from "@sveltejs/kit";
import { bindOAuthAuthorizationCodeRedirectToActiveGrant } from "@/features/oauth/server/oauth-authorization-code-grant.server";
import { rotateOAuthUserGrantAfterConsent } from "@/features/oauth/server/user-authorizations.server";
import { isTrustedAuthOrigin } from "@/lib/auth/auth-origins";
import { prisma } from "@/lib/db/prisma";
import { getCanonicalOAuthIssuer } from "@/lib/mcp/urls";
import { asOAuthProviderApi } from "@/lib/oauth/provider-api";
import { parseOAuthConsentForm } from "./oauth-authorize-form";

const OAUTH_SIGNED_QUERY_KEYS = new Set(["sig", "exp", "ba_iat", "ba_pl"]);
const OAUTH_CODE_LENGTH = 32;
const OAUTH_CODE_EXPIRES_IN_SECONDS = 600;
const OAUTH_CODE_ALPHABET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

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

type OAuthSessionApi = {
  getSession(input: { headers: Headers }): Promise<{
    session?: {
      id?: unknown;
      createdAt?: unknown;
    };
    user?: {
      id?: unknown;
    };
  } | null>;
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

function asOAuthSessionApi(api: unknown): OAuthSessionApi | null {
  if (!api || typeof api !== "object") return null;
  const getSession = (api as { getSession?: unknown }).getSession;
  if (typeof getSession !== "function") return null;
  return {
    getSession: getSession.bind(api) as OAuthSessionApi["getSession"],
  };
}

async function rotateAcceptedOAuthGrant(input: {
  authApi: unknown;
  headers: Headers;
  oauthQuery: string;
  scope: string;
}) {
  const query = new URLSearchParams(input.oauthQuery);
  const clientIds = query.getAll("client_id");
  if (clientIds.length !== 1 || !clientIds[0]) return null;

  const session = await asOAuthSessionApi(input.authApi)?.getSession({
    headers: input.headers,
  });
  const userId = session?.user?.id;
  if (typeof userId !== "string") return null;

  return rotateOAuthUserGrantAfterConsent({
    clientId: clientIds[0],
    scopes: input.scope.split(/\s+/).filter(Boolean),
    userId,
  });
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

function randomOAuthCode() {
  const bytes = new Uint8Array(OAUTH_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(
    bytes,
    (byte) => OAUTH_CODE_ALPHABET[byte % OAUTH_CODE_ALPHABET.length],
  ).join("");
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

async function sha256Base64Url(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return base64UrlEncode(new Uint8Array(digest));
}

function authTimeFromSessionCreatedAt(createdAt: unknown) {
  if (!(createdAt instanceof Date) && typeof createdAt !== "string") {
    return undefined;
  }
  const authTime = new Date(createdAt).getTime();
  return Number.isFinite(authTime) ? authTime : undefined;
}

async function requestOAuthAuthorizeTarget({
  authorizeApi,
  authorizeQuery,
  headers,
  requestUrl,
}: {
  authorizeApi: OAuthAuthorizeApi;
  authorizeQuery: Record<string, string>;
  headers: Headers;
  requestUrl: string;
}) {
  const authorizeHeaders = new Headers(headers);
  authorizeHeaders.delete("content-type");
  const authorizeUrl = new URL("/api/auth/oauth2/authorize", requestUrl);
  authorizeUrl.search = new URLSearchParams(authorizeQuery).toString();
  const authorizePayload = await authorizeApi.oauth2Authorize({
    asResponse: false,
    headers: authorizeHeaders,
    request: new Request(authorizeUrl, {
      method: "GET",
      headers: authorizeHeaders,
    }),
    query: authorizeQuery,
  });
  return redirectPayloadTarget(authorizePayload);
}

async function issueAuthorizationCodeRedirect({
  acceptedScope,
  expectedGrantId,
  authApi,
  authorizeQuery,
  headers,
}: {
  acceptedScope: string;
  expectedGrantId?: string;
  authApi: unknown;
  authorizeQuery: Record<string, string>;
  headers: Headers;
}) {
  const redirectUri = authorizeQuery.redirect_uri;
  if (!redirectUri) return undefined;

  const sessionApi = asOAuthSessionApi(authApi);
  const session = await sessionApi?.getSession({ headers });
  const sessionId = session?.session?.id;
  const userId = session?.user?.id;
  if (typeof sessionId !== "string" || typeof userId !== "string") {
    return undefined;
  }

  const code = randomOAuthCode();
  const iat = Math.floor(Date.now() / 1000);
  const issuedAt = new Date(iat * 1000);
  const query: Record<string, string> = {
    ...authorizeQuery,
    ...(acceptedScope.trim() ? { scope: acceptedScope.trim() } : {}),
  };
  const authTime = authTimeFromSessionCreatedAt(session?.session?.createdAt);
  await prisma.verificationToken.create({
    data: {
      identifier: await sha256Base64Url(code),
      token: JSON.stringify({
        type: "authorization_code",
        query,
        userId,
        sessionId,
        ...(expectedGrantId ? { referenceId: expectedGrantId } : {}),
        ...(authTime !== undefined ? { authTime } : {}),
      }),
      expires: new Date((iat + OAUTH_CODE_EXPIRES_IN_SECONDS) * 1000),
      createdAt: issuedAt,
      updatedAt: issuedAt,
    },
  });

  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set("code", code);
  if (query.state) callbackUrl.searchParams.set("state", query.state);
  callbackUrl.searchParams.set("iss", getCanonicalOAuthIssuer());
  return callbackUrl.toString();
}

async function resolveAuthorizeRedirectAfterConsent({
  accept,
  authApi,
  acceptedScope,
  expectedGrantId,
  headers,
  requestUrl,
  redirectTarget,
}: {
  accept: boolean;
  authApi: unknown;
  acceptedScope: string;
  expectedGrantId?: string;
  headers: Headers;
  requestUrl: string;
  redirectTarget: string;
}) {
  if (!isOAuthAuthorizePageRedirect(redirectTarget, requestUrl)) {
    return redirectTarget;
  }

  const authorizeApi = asOAuthAuthorizeApi(authApi);
  if (!authorizeApi) return undefined;

  const authorizeQuery = oauthAuthorizeQueryFromRedirect(
    redirectTarget,
    requestUrl,
  );
  const nextTarget = await requestOAuthAuthorizeTarget({
    authorizeApi,
    authorizeQuery,
    headers,
    requestUrl,
  });
  if (nextTarget && !isOAuthAuthorizePageRedirect(nextTarget, requestUrl)) {
    return nextTarget;
  }

  return accept
    ? issueAuthorizationCodeRedirect({
        acceptedScope,
        expectedGrantId,
        authApi,
        authorizeQuery,
        headers,
      })
    : undefined;
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
    const acceptedGrant = accept
      ? await rotateAcceptedOAuthGrant({
          authApi,
          headers,
          oauthQuery,
          scope,
        })
      : null;
    if (accept && !acceptedGrant) {
      throw new Error("OAuth grant generation could not be rotated");
    }
    if (redirectTarget) {
      redirectTarget = await resolveAuthorizeRedirectAfterConsent({
        accept,
        authApi,
        acceptedScope: scope,
        expectedGrantId:
          acceptedGrant?.kind === "consent" ? acceptedGrant.grantId : undefined,
        headers,
        requestUrl: request.url,
        redirectTarget,
      });
    }
    const clientIds = new URLSearchParams(oauthQuery).getAll("client_id");
    if (
      accept &&
      redirectTarget &&
      (clientIds.length !== 1 ||
        !clientIds[0] ||
        !(await bindOAuthAuthorizationCodeRedirectToActiveGrant(
          redirectTarget,
          clientIds[0],
          request.url,
          acceptedGrant?.kind === "consent" ? acceptedGrant.grantId : undefined,
        )))
    ) {
      throw new Error("OAuth authorization code could not be grant-bound");
    }
  } catch {
    redirectTarget = undefined;
  }

  if (redirectTarget) {
    throw redirect(303, redirectTarget);
  }
  throw redirect(303, "/error?error=consent_failed");
}
