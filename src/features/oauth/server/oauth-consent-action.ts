import { error, redirect } from "@sveltejs/kit";
import { bindOAuthAuthorizationCodeRedirectToActiveGrant } from "@/features/oauth/server/oauth-authorization-code-grant.server";
import { verifyOAuthProviderSignedQueryState } from "@/features/oauth/server/signed-oauth-query.server";
import { isTrustedAuthOrigin } from "@/lib/auth/auth-origins";
import { prisma } from "@/lib/db/prisma";
import { getCanonicalOAuthIssuer } from "@/lib/mcp/urls";
import { hashOAuthClientSecretForDbStorage } from "@/lib/oauth/utils";
import { parseOAuthConsentForm } from "./oauth-authorize-form";

const OAUTH_CODE_LENGTH = 32;
const OAUTH_CODE_EXPIRES_IN_SECONDS = 600;
const OAUTH_CODE_ALPHABET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const OAUTH_SINGLETON_QUERY_FIELDS = [
  "client_id",
  "redirect_uri",
  "response_type",
  "scope",
  "state",
  "code_challenge",
  "code_challenge_method",
  "nonce",
  "prompt",
] as const;

type OAuthSession = {
  session: {
    createdAt?: unknown;
    id: string;
  };
  user: {
    id: string;
  };
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

type OAuthConsentClientReader = {
  oAuthClient: {
    findUnique(input: {
      where: { clientId: string };
      select: {
        disabled: true;
        public: true;
        requirePKCE: true;
        redirectUris: true;
        scopes: true;
        skipConsent: true;
        tokenEndpointAuthMethod: true;
        type: true;
      };
    }): Promise<{
      disabled: boolean;
      public: boolean | null;
      requirePKCE: boolean | null;
      redirectUris: string[];
      scopes: string[];
      skipConsent: boolean | null;
      tokenEndpointAuthMethod: string | null;
      type: string | null;
    } | null>;
  };
};

type ValidatedConsentRequest = {
  authorizeQuery: URLSearchParams;
  clientId: string;
  redirectUri: string;
  requestedScopes: string[];
};

function assertTrustedCookieRequestOrigin(request: Request) {
  const headers = request.headers;
  if (!headers.has("cookie")) return;

  const origin = headers.get("origin") || headers.get("referer");
  if (!origin || origin === "null" || !isTrustedAuthOrigin(origin)) {
    throw error(403, "Invalid origin");
  }
}

function asOAuthSessionApi(api: unknown): OAuthSessionApi | null {
  if (!api || typeof api !== "object") return null;
  const getSession = (api as { getSession?: unknown }).getSession;
  if (typeof getSession !== "function") return null;
  return {
    getSession: getSession.bind(api) as OAuthSessionApi["getSession"],
  };
}

async function getOAuthSession(authApi: unknown, headers: Headers) {
  const session = await asOAuthSessionApi(authApi)?.getSession({ headers });
  const sessionId = session?.session?.id;
  const userId = session?.user?.id;
  if (typeof sessionId !== "string" || typeof userId !== "string") return null;

  return {
    session: {
      createdAt: session?.session?.createdAt,
      id: sessionId,
    },
    user: { id: userId },
  } satisfies OAuthSession;
}

function uniqueScopes(value: string | null) {
  return [...new Set((value ?? "").split(/\s+/).filter(Boolean))];
}

function hasOnlySingletonQueryFields(query: URLSearchParams) {
  return OAUTH_SINGLETON_QUERY_FIELDS.every(
    (field) => query.getAll(field).length <= 1,
  );
}

async function validateConsentRequest(
  reader: OAuthConsentClientReader,
  authorizeQuery: URLSearchParams,
): Promise<
  | (ValidatedConsentRequest & {
      client: {
        skipConsent: boolean | null;
      };
    })
  | null
> {
  if (!hasOnlySingletonQueryFields(authorizeQuery)) return null;

  const clientId = authorizeQuery.get("client_id");
  const redirectUri = authorizeQuery.get("redirect_uri");
  if (
    !clientId ||
    !redirectUri ||
    authorizeQuery.get("response_type") !== "code"
  ) {
    return null;
  }

  const client = await reader.oAuthClient.findUnique({
    where: { clientId },
    select: {
      disabled: true,
      public: true,
      requirePKCE: true,
      redirectUris: true,
      scopes: true,
      skipConsent: true,
      tokenEndpointAuthMethod: true,
      type: true,
    },
  });
  const requestedScopes = uniqueScopes(authorizeQuery.get("scope"));
  const codeChallenge = authorizeQuery.get("code_challenge");
  const codeChallengeMethod = authorizeQuery.get("code_challenge_method");
  const requiresPkce =
    client?.tokenEndpointAuthMethod === "none" ||
    client?.type === "native" ||
    client?.type === "user-agent-based" ||
    client?.public === true ||
    requestedScopes.includes("offline_access") ||
    (client?.requirePKCE ?? true);
  if (
    !client ||
    client.disabled ||
    !client.redirectUris.includes(redirectUri) ||
    !requestedScopes.every((scope) => client.scopes.includes(scope)) ||
    (requiresPkce && (!codeChallenge || codeChallengeMethod !== "S256")) ||
    ((codeChallenge || codeChallengeMethod) &&
      (!codeChallenge || codeChallengeMethod !== "S256"))
  ) {
    return null;
  }

  return {
    authorizeQuery,
    client: { skipConsent: client.skipConsent },
    clientId,
    redirectUri,
    requestedScopes,
  };
}

function randomOAuthCode() {
  const bytes = new Uint8Array(OAUTH_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(
    bytes,
    (byte) => OAUTH_CODE_ALPHABET[byte % OAUTH_CODE_ALPHABET.length],
  ).join("");
}

function sessionCreatedAtMillis(createdAt: unknown) {
  if (createdAt instanceof Date) {
    return Number.isFinite(createdAt.getTime()) ? createdAt.getTime() : null;
  }
  if (typeof createdAt === "number") {
    return Number.isFinite(createdAt) ? createdAt : null;
  }
  if (typeof createdAt === "string") {
    const trimmed = createdAt.trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed);
    const timestamp = Number.isFinite(numeric)
      ? numeric
      : new Date(trimmed).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }
  return null;
}

function removePrompt(query: URLSearchParams, removedPrompt: string) {
  const prompts = (query.get("prompt") ?? "")
    .split(/\s+/)
    .filter((prompt) => prompt && prompt !== removedPrompt);
  if (prompts.length > 0) {
    query.set("prompt", prompts.join(" "));
  } else {
    query.delete("prompt");
  }
}

function searchParamsToQuery(query: URLSearchParams) {
  const result: Record<string, string | string[]> = Object.create(null);
  for (const key of new Set(query.keys())) {
    const values = query.getAll(key);
    result[key] = values.length === 1 ? values[0] : values;
  }
  return result;
}

function buildOAuthCallbackUrl(input: {
  code?: string;
  error?: string;
  errorDescription?: string;
  query: URLSearchParams;
  redirectUri: string;
}) {
  const callback = new URL(input.redirectUri);
  if (input.code) callback.searchParams.set("code", input.code);
  if (input.error) callback.searchParams.set("error", input.error);
  if (input.errorDescription) {
    callback.searchParams.set("error_description", input.errorDescription);
  }
  const state = input.query.get("state");
  if (state) callback.searchParams.set("state", state);
  callback.searchParams.set("iss", getCanonicalOAuthIssuer());
  return callback.toString();
}

export async function createAcceptedOAuthAuthorization(input: {
  acceptedScopes: readonly string[];
  authorizeQuery: URLSearchParams;
  session: OAuthSession;
}) {
  const normalizedAcceptedScopes = [...new Set(input.acceptedScopes)];
  return prisma.$transaction(async (tx) => {
    const request = await validateConsentRequest(tx, input.authorizeQuery);
    if (
      !request ||
      !normalizedAcceptedScopes.every((scope) =>
        request.requestedScopes.includes(scope),
      )
    ) {
      return null;
    }

    const identity = {
      clientId: request.clientId,
      userId: input.session.user.id,
    };
    const grantId = crypto.randomUUID();
    if (request.client.skipConsent === true) {
      await tx.oAuthConsent.deleteMany({ where: identity });
    } else {
      await tx.oAuthAccessToken.deleteMany({ where: identity });
      await tx.oAuthRefreshToken.deleteMany({ where: identity });
      await tx.deviceCode.deleteMany({ where: identity });
      await tx.oAuthConsent.upsert({
        where: { clientId_userId: identity },
        create: {
          ...identity,
          grantId,
          scopes: normalizedAcceptedScopes,
        },
        update: {
          grantId,
          scopes: normalizedAcceptedScopes,
        },
      });
    }

    const code = randomOAuthCode();
    const iat = Math.floor(Date.now() / 1000);
    const issuedAt = new Date(iat * 1000);
    const query = new URLSearchParams(request.authorizeQuery);
    query.set("scope", normalizedAcceptedScopes.join(" "));
    removePrompt(query, "consent");
    const queryObject = searchParamsToQuery(query);
    const authTime = sessionCreatedAtMillis(input.session.session.createdAt);
    await tx.verificationToken.create({
      data: {
        identifier: await hashOAuthClientSecretForDbStorage(code),
        token: JSON.stringify({
          type: "authorization_code",
          query: queryObject,
          userId: input.session.user.id,
          sessionId: input.session.session.id,
          referenceId: grantId,
          ...(authTime !== null ? { authTime } : {}),
        }),
        expires: new Date((iat + OAUTH_CODE_EXPIRES_IN_SECONDS) * 1000),
        createdAt: issuedAt,
        updatedAt: issuedAt,
      },
    });

    return {
      clientId: request.clientId,
      expectedGrantId: grantId,
      redirectTarget: buildOAuthCallbackUrl({
        code,
        query,
        redirectUri: request.redirectUri,
      }),
    };
  });
}

async function createDeniedOAuthAuthorization(authorizeQuery: URLSearchParams) {
  const request = await validateConsentRequest(prisma, authorizeQuery);
  if (!request) return null;

  return buildOAuthCallbackUrl({
    error: "access_denied",
    errorDescription: "User denied access",
    query: authorizeQuery,
    redirectUri: request.redirectUri,
  });
}

export async function submitOAuthConsentAction({
  request,
}: {
  request: Request;
}) {
  assertTrustedCookieRequestOrigin(request);

  const form = await request.formData();
  const { accept, oauthQuery, scope } = parseOAuthConsentForm(form);

  let redirectTarget: string | undefined;
  try {
    const authCore = await import("@/lib/auth/core");
    const [signedState, session] = await Promise.all([
      verifyOAuthProviderSignedQueryState(oauthQuery),
      getOAuthSession(authCore.authApi, request.headers),
    ]);
    if (!signedState || !session) {
      throw new Error("Invalid OAuth consent state");
    }
    const { issuedAt, postLoginClearedForSession } = signedState;
    const authorizeQuery = signedState.query;
    const prompts = new Set(
      (authorizeQuery.get("prompt") ?? "").split(/\s+/).filter(Boolean),
    );
    const sessionCreatedAt = sessionCreatedAtMillis(session.session.createdAt);

    if (!accept) {
      redirectTarget =
        (await createDeniedOAuthAuthorization(authorizeQuery)) ?? undefined;
    } else {
      if (
        (postLoginClearedForSession !== null &&
          postLoginClearedForSession !== session.session.id) ||
        (prompts.has("login") &&
          (!issuedAt ||
            sessionCreatedAt === null ||
            sessionCreatedAt < issuedAt.getTime()))
      ) {
        throw new Error("OAuth consent session no longer satisfies the prompt");
      }
      if (prompts.has("login")) removePrompt(authorizeQuery, "login");
      const authorization = await createAcceptedOAuthAuthorization({
        acceptedScopes: uniqueScopes(scope),
        authorizeQuery,
        session,
      });
      if (
        !authorization ||
        !(await bindOAuthAuthorizationCodeRedirectToActiveGrant(
          authorization.redirectTarget,
          authorization.clientId,
          request.url,
          authorization.expectedGrantId,
        ))
      ) {
        throw new Error("OAuth authorization code could not be grant-bound");
      }
      redirectTarget = authorization.redirectTarget;
    }
  } catch {
    redirectTarget = undefined;
  }

  if (redirectTarget) {
    throw redirect(303, redirectTarget);
  }
  throw redirect(303, "/error?error=consent_failed");
}
