import { error, redirect } from "@sveltejs/kit";
import { bindOAuthAuthorizationCodeRedirectToActiveGrant } from "@/features/oauth/server/oauth-authorization-code-grant.server";
import { verifyOAuthProviderSignedQueryState } from "@/features/oauth/server/signed-oauth-query.server";
import {
  type AuditLogParams,
  fireAuditLog,
  getAuditRequestMetadata,
  writeAuditLog,
} from "@/lib/audit/write-audit-log";
import { isTrustedAuthOrigin } from "@/lib/auth/auth-origins";
import { resolveAuthoritativeRecentSession } from "@/lib/auth/recent-session";
import { authPrisma as prisma } from "@/lib/db/auth-prisma";
import { runSerializableTransaction } from "@/lib/db/serializable-transaction";
import { getCanonicalOAuthIssuer } from "@/lib/mcp/urls";
import { OAUTH_PROVIDER_CLAIMS_SUPPORTED } from "@/lib/oauth/constants";
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
  "claims",
] as const;

const SUPPORTED_USERINFO_CLAIMS = new Set<string>(
  OAUTH_PROVIDER_CLAIMS_SUPPORTED,
);

class OAuthRecentAuthRequiredError extends Error {}

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
        applicationType: true;
        disabled: true;
        requirePKCE: true;
        redirectUris: true;
        scopes: true;
        skipConsent: true;
        tokenEndpointAuthMethod: true;
      };
    }): Promise<{
      applicationType: string | null;
      disabled: boolean;
      requirePKCE: boolean | null;
      redirectUris: string[];
      scopes: string[];
      skipConsent: boolean | null;
      tokenEndpointAuthMethod: string | null;
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

function mergeUniqueValues(
  current: readonly string[],
  additions: readonly string[],
) {
  return [...new Set([...current, ...additions])];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isClaimsRequestSection(value: unknown) {
  return (
    value === undefined ||
    (isRecord(value) &&
      Object.values(value).every(
        (member) => member === null || isRecord(member),
      ))
  );
}

function requestedUserInfoClaims(value: string | null) {
  if (!value) return [];
  try {
    const claims = JSON.parse(value) as unknown;
    if (
      !isRecord(claims) ||
      !isClaimsRequestSection(claims.userinfo) ||
      !isClaimsRequestSection(claims.id_token) ||
      !isRecord(claims.userinfo)
    ) {
      return [];
    }
    return Object.keys(claims.userinfo).filter((claim) =>
      SUPPORTED_USERINFO_CLAIMS.has(claim),
    );
  } catch {
    return [];
  }
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
        scopes: string[];
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
      applicationType: true,
      disabled: true,
      requirePKCE: true,
      redirectUris: true,
      scopes: true,
      skipConsent: true,
      tokenEndpointAuthMethod: true,
    },
  });
  const requestedScopes = uniqueScopes(authorizeQuery.get("scope"));
  const codeChallenge = authorizeQuery.get("code_challenge");
  const codeChallengeMethod = authorizeQuery.get("code_challenge_method");
  const requiresPkce =
    client?.tokenEndpointAuthMethod === "none" ||
    client?.applicationType === "native" ||
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
    client: { scopes: client.scopes, skipConsent: client.skipConsent },
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
  audit?: Pick<
    AuditLogParams,
    "channel" | "ipAddress" | "requestId" | "userAgent"
  >;
  authorizeQuery: URLSearchParams;
  session: OAuthSession;
}) {
  const normalizedAcceptedScopes = [...new Set(input.acceptedScopes)];
  return runSerializableTransaction(
    async (tx) => {
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
      const resources = request.authorizeQuery.getAll("resource");
      const userInfoClaims = requestedUserInfoClaims(
        request.authorizeQuery.get("claims"),
      );
      let grantId: string;
      let existingConsentId: string | null = null;
      if (request.client.skipConsent === true) {
        grantId = crypto.randomUUID();
        await tx.oAuthConsent.deleteMany({ where: identity });
      } else {
        existingConsentId =
          (
            await tx.oAuthConsent.findUnique({
              where: { clientId_userId: identity },
              select: { id: true },
            })
          )?.id ?? null;
        const consent = await tx.oAuthConsent.upsert({
          where: { clientId_userId: identity },
          create: {
            ...identity,
            resources,
            requestedUserInfoClaims: userInfoClaims,
            scopes: normalizedAcceptedScopes,
          },
          update: {},
          select: {
            grantId: true,
            requestedUserInfoClaims: true,
            resources: true,
            scopes: true,
          },
        });
        grantId = consent.grantId;
        await tx.oAuthConsent.update({
          where: { clientId_userId: identity },
          data: {
            requestedUserInfoClaims: mergeUniqueValues(
              consent.requestedUserInfoClaims,
              userInfoClaims,
            ),
            resources: mergeUniqueValues(consent.resources, resources),
            scopes: mergeUniqueValues(
              consent.scopes.filter((scope) =>
                request.client.scopes.includes(scope),
              ),
              normalizedAcceptedScopes,
            ),
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

      await writeAuditLog(
        {
          action: existingConsentId
            ? "oauth_authorization_update"
            : "oauth_authorization_grant",
          channel: "auth",
          oauthClientId: request.clientId,
          oauthGrantId: grantId,
          sessionId: input.session.session.id,
          subjectUserId: input.session.user.id,
          targetId: existingConsentId ?? request.clientId,
          targetType: existingConsentId ? "oauth_consent" : "oauth_client",
          userId: input.session.user.id,
          metadata: {
            changedFields: ["resources", "scopes", "userinfoClaims"],
            resourceCount: resources.length,
            scopeCount: normalizedAcceptedScopes.length,
          },
          ...input.audit,
        },
        tx,
      );

      return {
        clientId: request.clientId,
        expectedGrantId: grantId,
        redirectTarget: buildOAuthCallbackUrl({
          code,
          query,
          redirectUri: request.redirectUri,
        }),
      };
    },
    "Failed to create OAuth authorization",
    prisma,
  );
}

async function createDeniedOAuthAuthorization(input: {
  audit: Pick<
    AuditLogParams,
    "channel" | "ipAddress" | "requestId" | "userAgent"
  >;
  authorizeQuery: URLSearchParams;
  session: OAuthSession;
}) {
  const request = await validateConsentRequest(prisma, input.authorizeQuery);
  if (!request) return null;

  await fireAuditLog({
    action: "oauth_authorization_grant",
    oauthClientId: request.clientId,
    outcome: "denied",
    sessionId: input.session.session.id,
    subjectUserId: input.session.user.id,
    targetId: request.clientId,
    targetType: "oauth_client",
    userId: input.session.user.id,
    metadata: { reason: "user_denied" },
    ...input.audit,
  });

  return buildOAuthCallbackUrl({
    error: "access_denied",
    errorDescription: "User denied access",
    query: input.authorizeQuery,
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
  let failureCode = "consent_failed";
  let failedMutationAudit: AuditLogParams | undefined;
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
        (await createDeniedOAuthAuthorization({
          audit: { channel: "web", ...getAuditRequestMetadata(request) },
          authorizeQuery,
          session,
        })) ?? undefined;
    } else {
      const validated = await validateConsentRequest(prisma, authorizeQuery);
      if (!validated) throw new Error("Invalid OAuth consent request");
      const existingConsent = await prisma.oAuthConsent.findUnique({
        where: {
          clientId_userId: {
            clientId: validated.clientId,
            userId: session.user.id,
          },
        },
        select: { id: true },
      });
      failedMutationAudit = {
        action: existingConsent
          ? "oauth_authorization_update"
          : "oauth_authorization_grant",
        channel: "web",
        oauthClientId: validated.clientId,
        outcome: "failure",
        sessionId: session.session.id,
        subjectUserId: session.user.id,
        targetId: existingConsent?.id ?? validated.clientId,
        targetType: existingConsent ? "oauth_consent" : "oauth_client",
        userId: session.user.id,
        metadata: { reason: "operation_failed" },
        ...getAuditRequestMetadata(request),
      };
      const recent = await resolveAuthoritativeRecentSession(request.headers, {
        expectedUserId: session.user.id,
      });
      if (!recent.ok) {
        await fireAuditLog({
          action: existingConsent
            ? "oauth_authorization_update"
            : "oauth_authorization_grant",
          channel: "web",
          oauthClientId: validated.clientId,
          outcome: "denied",
          sessionId: recent.sessionId ?? session.session.id,
          subjectUserId: session.user.id,
          targetId: existingConsent?.id ?? validated.clientId,
          targetType: existingConsent ? "oauth_consent" : "oauth_client",
          userId: session.user.id,
          metadata: { reason: recent.reason },
          ...getAuditRequestMetadata(request),
        });
        throw new OAuthRecentAuthRequiredError();
      }
      if (
        (postLoginClearedForSession !== null &&
          postLoginClearedForSession !== session.session.id) ||
        (prompts.has("login") &&
          (!issuedAt ||
            sessionCreatedAt === null ||
            sessionCreatedAt < issuedAt.getTime()))
      ) {
        await fireAuditLog({
          ...failedMutationAudit,
          outcome: "denied",
          metadata: { reason: "prompt_not_satisfied" },
        });
        failedMutationAudit = undefined;
        throw new Error("OAuth consent session no longer satisfies the prompt");
      }
      if (prompts.has("login")) removePrompt(authorizeQuery, "login");
      const authorization = await createAcceptedOAuthAuthorization({
        acceptedScopes: uniqueScopes(scope),
        audit: {
          channel: "web",
          ...getAuditRequestMetadata(request),
        },
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
  } catch (error) {
    if (error instanceof OAuthRecentAuthRequiredError) {
      failureCode = "recent_auth_required";
    } else if (failedMutationAudit) {
      await fireAuditLog(failedMutationAudit);
    }
    redirectTarget = undefined;
  }

  if (redirectTarget) {
    throw redirect(303, redirectTarget);
  }
  throw redirect(303, `/error?error=${failureCode}`);
}
