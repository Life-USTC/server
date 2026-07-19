import { decodeJwt } from "jose";
import { jsonResponse } from "@/lib/api/helpers";
import { prisma } from "@/lib/db/prisma";
import { resolveActiveOAuthUserGrant } from "@/lib/oauth/active-user-grant";
import { OAUTH_GRANT_ID_CLAIM } from "@/lib/oauth/constants";
import { hashOAuthClientSecretForDbStorage } from "@/lib/oauth/utils";

type UserTokenEvidence = {
  clientId: string;
  grantId?: string;
  opaqueTokenHash?: string;
  scopes: string[];
  userId: string;
};

async function getTokenBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;

  try {
    const body = await response.clone().json();
    return body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function tokenScopes(scope: unknown) {
  return typeof scope === "string"
    ? [...new Set(scope.split(/\s+/).filter(Boolean))]
    : [];
}

function scopesAreSubset(
  scopes: readonly string[],
  allowedScopes: readonly string[],
) {
  return scopes.every((scope) => allowedScopes.includes(scope));
}

function inactiveGrantResponse() {
  return jsonResponse(
    {
      error: "invalid_grant",
      error_description: "OAuth authorization is no longer active",
    },
    {
      status: 400,
      headers: {
        "Cache-Control": "no-store",
        Pragma: "no-cache",
      },
    },
  );
}

async function resolveAccessTokenEvidence(
  accessToken: string,
): Promise<UserTokenEvidence | "machine" | null> {
  if (accessToken.split(".").length === 3) {
    try {
      const payload = decodeJwt(accessToken);
      const userId = typeof payload.sub === "string" ? payload.sub : null;
      if (!userId) return "machine";
      const clientId = typeof payload.azp === "string" ? payload.azp : null;
      if (!clientId) return null;
      return {
        clientId,
        ...(typeof payload[OAUTH_GRANT_ID_CLAIM] === "string"
          ? { grantId: payload[OAUTH_GRANT_ID_CLAIM] }
          : {}),
        scopes: tokenScopes(payload.scope),
        userId,
      };
    } catch {
      return null;
    }
  }

  const opaqueTokenHash = await hashOAuthClientSecretForDbStorage(accessToken);
  const row = await prisma.oAuthAccessToken.findUnique({
    where: { token: opaqueTokenHash },
    select: {
      clientId: true,
      grantId: true,
      referenceId: true,
      scopes: true,
      userId: true,
    },
  });
  if (!row) return null;
  if (!row.userId) return "machine";
  return {
    clientId: row.clientId,
    ...((row.grantId ?? row.referenceId)
      ? { grantId: row.grantId ?? row.referenceId ?? undefined }
      : {}),
    opaqueTokenHash,
    scopes: row.scopes,
    userId: row.userId,
  };
}

async function deleteReturnedTokenRows(input: {
  accessTokenHash?: string;
  refreshTokenHash?: string;
}) {
  await Promise.all([
    input.accessTokenHash
      ? prisma.oAuthAccessToken.deleteMany({
          where: { token: input.accessTokenHash },
        })
      : undefined,
    input.refreshTokenHash
      ? prisma.oAuthRefreshToken.deleteMany({
          where: { token: input.refreshTokenHash },
        })
      : undefined,
  ]);
}

/**
 * Require every delegated user token returned by Better Auth to inherit one
 * immutable grant generation. The inherited reference is persisted on opaque
 * rows, but an unbound response is never attached to the latest consent.
 */
export async function bindOAuthAccessTokenToConsent(
  response: Response,
  requestedRefreshScopes?: readonly string[],
) {
  if (!response.ok) return response;

  const body = await getTokenBody(response);
  const accessToken =
    typeof body?.access_token === "string" ? body.access_token : null;
  if (!body || !accessToken) return inactiveGrantResponse();

  const evidence = await resolveAccessTokenEvidence(accessToken);
  if (evidence === "machine") return response;
  if (!evidence) return inactiveGrantResponse();

  const refreshToken =
    typeof body.refresh_token === "string" ? body.refresh_token : null;
  const refreshTokenHash = refreshToken
    ? await hashOAuthClientSecretForDbStorage(refreshToken)
    : undefined;
  const refreshRow = refreshTokenHash
    ? await prisma.oAuthRefreshToken.findUnique({
        where: { token: refreshTokenHash },
        select: {
          clientId: true,
          grantId: true,
          referenceId: true,
          scopes: true,
          userId: true,
        },
      })
    : null;
  if (
    refreshTokenHash &&
    (!refreshRow ||
      refreshRow.clientId !== evidence.clientId ||
      refreshRow.userId !== evidence.userId)
  ) {
    await deleteReturnedTokenRows({
      accessTokenHash: evidence.opaqueTokenHash,
      refreshTokenHash,
    });
    return inactiveGrantResponse();
  }

  const refreshGrantId = refreshRow?.grantId ?? refreshRow?.referenceId;
  if (
    evidence.grantId &&
    refreshGrantId &&
    evidence.grantId !== refreshGrantId
  ) {
    await deleteReturnedTokenRows({
      accessTokenHash: evidence.opaqueTokenHash,
      refreshTokenHash,
    });
    return inactiveGrantResponse();
  }

  const responseScopes =
    typeof body.scope === "string" ? tokenScopes(body.scope) : undefined;
  if (
    (requestedRefreshScopes &&
      !scopesAreSubset(evidence.scopes, requestedRefreshScopes)) ||
    (responseScopes && !scopesAreSubset(evidence.scopes, responseScopes)) ||
    (refreshRow &&
      (!scopesAreSubset(evidence.scopes, refreshRow.scopes) ||
        (requestedRefreshScopes &&
          !scopesAreSubset(refreshRow.scopes, requestedRefreshScopes)) ||
        (responseScopes &&
          !scopesAreSubset(refreshRow.scopes, responseScopes))))
  ) {
    await deleteReturnedTokenRows({
      accessTokenHash: evidence.opaqueTokenHash,
      refreshTokenHash,
    });
    return inactiveGrantResponse();
  }

  const expectedGrantId = evidence.grantId ?? refreshGrantId ?? undefined;
  const grantedScopes = [
    ...new Set([...evidence.scopes, ...(refreshRow?.scopes ?? [])]),
  ];
  const grant = await resolveActiveOAuthUserGrant({
    clientId: evidence.clientId,
    grantId: expectedGrantId,
    requireGrantBinding: true,
    scopes: grantedScopes,
    userId: evidence.userId,
  });
  if (!grant) {
    await deleteReturnedTokenRows({
      accessTokenHash: evidence.opaqueTokenHash,
      refreshTokenHash,
    });
    return inactiveGrantResponse();
  }
  if (grant.kind === "trusted") return response;

  if (!expectedGrantId) {
    await deleteReturnedTokenRows({
      accessTokenHash: evidence.opaqueTokenHash,
      refreshTokenHash,
    });
    return inactiveGrantResponse();
  }

  const grantId = expectedGrantId;
  const updates = await Promise.all([
    evidence.opaqueTokenHash
      ? prisma.oAuthAccessToken.updateMany({
          where: {
            token: evidence.opaqueTokenHash,
            clientId: evidence.clientId,
            userId: evidence.userId,
          },
          data: { grantId, referenceId: grantId },
        })
      : undefined,
    refreshTokenHash
      ? prisma.oAuthRefreshToken.updateMany({
          where: {
            token: refreshTokenHash,
            clientId: evidence.clientId,
            userId: evidence.userId,
          },
          data: { grantId, referenceId: grantId },
        })
      : undefined,
  ]);
  if (
    (evidence.opaqueTokenHash && updates[0]?.count !== 1) ||
    (refreshTokenHash && updates[1]?.count !== 1) ||
    !(await resolveActiveOAuthUserGrant({
      clientId: evidence.clientId,
      grantId,
      requireGrantBinding: true,
      scopes: grantedScopes,
      userId: evidence.userId,
    }))
  ) {
    await deleteReturnedTokenRows({
      accessTokenHash: evidence.opaqueTokenHash,
      refreshTokenHash,
    });
    return inactiveGrantResponse();
  }

  return response;
}
