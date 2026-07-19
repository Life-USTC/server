import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  hasActiveOAuthUserGrant,
  type OAuthUserGrantIdentity,
} from "@/lib/oauth/active-user-grant";
import { hashOAuthClientSecretForDbStorage } from "@/lib/oauth/utils";

export type UserOAuthAuthorization = {
  consentId: string;
  clientName: string | null;
  clientUri: string | null;
  disabled: boolean;
  scopes: string[];
  updatedAt: string;
};

export type RevokeUserOAuthAuthorizationResult =
  | {
      ok: true;
      deleted: {
        accessTokens: number;
        consents: number;
        deviceCodes: number;
        refreshTokens: number;
      };
    }
  | { ok: false; reason: "not_found" };

export async function listUserOAuthAuthorizations(
  userId: string,
): Promise<UserOAuthAuthorization[]> {
  const rows = await prisma.oAuthConsent.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      clientId: true,
      scopes: true,
      updatedAt: true,
      client: {
        select: {
          disabled: true,
          name: true,
          uri: true,
        },
      },
    },
  });

  return rows.map((row) => {
    return {
      consentId: row.id,
      clientName: row.client.name,
      clientUri: row.client.uri,
      disabled: row.client.disabled,
      scopes: [...new Set(row.scopes)].sort(),
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

export async function revokeUserOAuthAuthorization(
  userId: string,
  consentId: string,
): Promise<RevokeUserOAuthAuthorizationResult> {
  const consent = await prisma.oAuthConsent.findFirst({
    where: { id: consentId, userId },
    select: { clientId: true },
  });
  if (!consent) return { ok: false, reason: "not_found" };

  const deleted = await prisma.$transaction(async (tx) => {
    const accessTokens = await tx.oAuthAccessToken.deleteMany({
      where: { clientId: consent.clientId, userId },
    });
    const refreshTokens = await tx.oAuthRefreshToken.deleteMany({
      where: { clientId: consent.clientId, userId },
    });
    const deviceCodes = await tx.deviceCode.deleteMany({
      where: { clientId: consent.clientId, userId },
    });
    const consents = await tx.oAuthConsent.deleteMany({
      where: { clientId: consent.clientId, userId },
    });

    return {
      accessTokens: accessTokens.count,
      consents: consents.count,
      deviceCodes: deviceCodes.count,
      refreshTokens: refreshTokens.count,
    };
  });

  return { ok: true, deleted };
}

export type ActiveOAuthRefreshGrant = OAuthUserGrantIdentity & {
  grantId?: string;
  scopes: string[];
};

export async function resolveActiveOAuthRefreshGrant(
  refreshToken: string | null,
): Promise<ActiveOAuthRefreshGrant | null> {
  if (!refreshToken) return null;

  const token = await hashOAuthClientSecretForDbStorage(refreshToken);
  const row = await prisma.oAuthRefreshToken.findUnique({
    where: { token },
    select: {
      clientId: true,
      expiresAt: true,
      grantId: true,
      revoked: true,
      scopes: true,
      userId: true,
    },
  });
  if (
    !row ||
    row.revoked ||
    row.expiresAt.getTime() <= Date.now() ||
    !(await hasActiveOAuthUserGrant({
      clientId: row.clientId,
      grantId: row.grantId ?? undefined,
      requireGrantBinding: true,
      scopes: row.scopes,
      userId: row.userId,
    }))
  ) {
    return null;
  }

  return {
    clientId: row.clientId,
    ...(row.grantId ? { grantId: row.grantId } : {}),
    scopes: row.scopes,
    userId: row.userId,
  };
}

export function isOAuthRefreshGrantActive(grant: ActiveOAuthRefreshGrant) {
  return hasActiveOAuthUserGrant({
    ...grant,
    requireGrantBinding: true,
  });
}

export async function purgeOAuthGrantTokenRows(grant: ActiveOAuthRefreshGrant) {
  const identity = { clientId: grant.clientId, userId: grant.userId };
  const lineage = grant.grantId
    ? {
        OR: [{ grantId: grant.grantId }, { referenceId: grant.grantId }],
      }
    : {};
  await prisma.$transaction(async (tx) => {
    await tx.oAuthAccessToken.deleteMany({
      where: { ...identity, ...lineage },
    });
    await tx.oAuthRefreshToken.deleteMany({
      where: { ...identity, ...lineage },
    });
  });
}

export type UpdateUserOAuthAuthorizationScopesResult =
  | { ok: true; consentId: string; grantId: string; scopes: string[] }
  | { ok: false; reason: "invalid_scope" | "not_found" };

async function rotateGrantInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    clientId: string;
    consentId: string;
    scopes: string[];
    userId: string;
  },
) {
  const grantId = crypto.randomUUID();
  const identity = { clientId: input.clientId, userId: input.userId };
  await tx.oAuthAccessToken.deleteMany({ where: identity });
  await tx.oAuthRefreshToken.deleteMany({ where: identity });
  await tx.deviceCode.deleteMany({ where: identity });
  const updated = await tx.oAuthConsent.updateMany({
    where: { id: input.consentId, ...identity },
    data: { grantId, scopes: input.scopes },
  });
  return updated.count === 1 ? grantId : null;
}

export async function updateUserOAuthAuthorizationScopes(
  userId: string,
  consentId: string,
  scopes: readonly string[],
): Promise<UpdateUserOAuthAuthorizationScopesResult> {
  const normalizedScopes = [...new Set(scopes)].sort();
  return prisma.$transaction(async (tx) => {
    const consent = await tx.oAuthConsent.findFirst({
      where: { id: consentId, userId },
      select: {
        clientId: true,
        client: { select: { scopes: true } },
      },
    });
    if (!consent) return { ok: false, reason: "not_found" };
    if (
      !normalizedScopes.every((scope) => consent.client.scopes.includes(scope))
    ) {
      return { ok: false, reason: "invalid_scope" };
    }

    const grantId = await rotateGrantInTransaction(tx, {
      clientId: consent.clientId,
      consentId,
      scopes: normalizedScopes,
      userId,
    });
    return grantId
      ? { ok: true, consentId, grantId, scopes: normalizedScopes }
      : { ok: false, reason: "not_found" };
  });
}

export async function rotateOAuthUserGrantAfterConsent(input: {
  clientId: string;
  scopes: readonly string[];
  userId: string;
}) {
  const scopes = [...new Set(input.scopes)].sort();
  return prisma.$transaction(async (tx) => {
    const consent = await tx.oAuthConsent.findUnique({
      where: {
        clientId_userId: {
          clientId: input.clientId,
          userId: input.userId,
        },
      },
      select: { id: true },
    });
    if (!consent) return null;
    const grantId = await rotateGrantInTransaction(tx, {
      clientId: input.clientId,
      consentId: consent.id,
      scopes,
      userId: input.userId,
    });
    return grantId ? { consentId: consent.id, grantId, scopes } : null;
  });
}
