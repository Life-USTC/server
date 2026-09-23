import type { Prisma } from "@/generated/prisma/client";
import {
  type AuditLogParams,
  writeAuditLog,
} from "@/lib/audit/write-audit-log";
import { authPrisma as prisma } from "@/lib/db/auth-prisma";
import {
  hasActiveOAuthUserGrant,
  type OAuthUserGrantIdentity,
} from "@/lib/oauth/active-user-grant";
import {
  OAUTH_REFRESH_REPLAY_TOMBSTONE_SCOPE,
  OAUTH_REFRESH_TOKEN_EXPIRES_IN_SECONDS,
} from "@/lib/oauth/constants";
import { oauthGrantUsageKey } from "@/lib/oauth/grant-usage";
import { hashOAuthClientSecretForDbStorage } from "@/lib/oauth/utils";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";

const NONTRUSTED_OAUTH_CLIENT_WHERE = {
  OR: [{ skipConsent: false }, { skipConsent: null }],
} satisfies Prisma.OAuthClientWhereInput;
export type OAuthAuthorizationAuditContext = Pick<
  AuditLogParams,
  "channel" | "ipAddress" | "requestId" | "sessionId" | "userAgent"
>;

const SYSTEM_OAUTH_AUDIT_CONTEXT = { channel: "system" } as const;
export type UserOAuthAuthorization = {
  consentId: string;
  clientName: string | null;
  clientUri: string | null;
  disabled: boolean;
  scopes: string[];
  updatedAt: string;
  usage: {
    lastUsedAt: string;
    lastChannel: string;
    lastFeature: string;
    readCount: number;
    writeCount: number;
    errorCount: number;
  } | null;
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
  now = new Date(),
): Promise<UserOAuthAuthorization[]> {
  const rows = await prisma.oAuthConsent.findMany({
    where: {
      userId,
      client: NONTRUSTED_OAUTH_CLIENT_WHERE,
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      clientId: true,
      grantId: true,
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

  const clientIds = [...new Set(rows.map((row) => row.clientId))];
  const usageRows = clientIds.length
    ? await prisma.oAuthGrantUsageDaily.findMany({
        where: {
          userId,
          clientId: { in: clientIds },
          day: {
            gte: new Date(
              `${shanghaiDayjs(now).subtract(29, "day").format("YYYY-MM-DD")}T00:00:00.000Z`,
            ),
          },
        },
        select: {
          clientId: true,
          grantKey: true,
          readCount: true,
          writeCount: true,
          errorCount: true,
          lastUsedAt: true,
          channel: true,
          feature: true,
        },
      })
    : [];
  const usageByGrant = new Map<
    string,
    NonNullable<UserOAuthAuthorization["usage"]>
  >();
  for (const usage of usageRows) {
    const key = `${usage.clientId}\u0000${usage.grantKey}`;
    const summary = usageByGrant.get(key);
    if (!summary) {
      usageByGrant.set(key, {
        lastUsedAt: usage.lastUsedAt.toISOString(),
        lastChannel: usage.channel,
        lastFeature: usage.feature,
        readCount: usage.readCount,
        writeCount: usage.writeCount,
        errorCount: usage.errorCount,
      });
      continue;
    }
    summary.readCount += usage.readCount;
    summary.writeCount += usage.writeCount;
    summary.errorCount += usage.errorCount;
    if (usage.lastUsedAt.getTime() > new Date(summary.lastUsedAt).getTime()) {
      summary.lastUsedAt = usage.lastUsedAt.toISOString();
      summary.lastChannel = usage.channel;
      summary.lastFeature = usage.feature;
    }
  }

  return rows.map((row) => {
    return {
      consentId: row.id,
      clientName: row.client.name,
      clientUri: row.client.uri,
      disabled: row.client.disabled,
      scopes: [...new Set(row.scopes)].sort(),
      updatedAt: row.updatedAt.toISOString(),
      usage:
        usageByGrant.get(
          `${row.clientId}\u0000${oauthGrantUsageKey(row.grantId)}`,
        ) ?? null,
    };
  });
}

export async function revokeUserOAuthAuthorization(
  userId: string,
  consentId: string,
  audit: OAuthAuthorizationAuditContext = SYSTEM_OAUTH_AUDIT_CONTEXT,
): Promise<RevokeUserOAuthAuthorizationResult> {
  const consent = await prisma.oAuthConsent.findFirst({
    where: {
      id: consentId,
      userId,
      client: NONTRUSTED_OAUTH_CLIENT_WHERE,
    },
    select: { clientId: true, grantId: true },
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
    await tx.oAuthGrantUsageDaily.deleteMany({
      where: { clientId: consent.clientId, userId },
    });
    const consents = await tx.oAuthConsent.deleteMany({
      where: { clientId: consent.clientId, userId },
    });

    await writeAuditLog(
      {
        action: "oauth_authorization_revoke",
        oauthClientId: consent.clientId,
        oauthGrantId: consent.grantId,
        subjectUserId: userId,
        targetId: consentId,
        targetType: "oauth_consent",
        userId,
        metadata: {
          revokedAccessTokenCount: accessTokens.count,
          revokedDeviceCodeCount: deviceCodes.count,
          revokedRefreshTokenCount: refreshTokens.count,
        },
        ...audit,
      },
      tx,
    );

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

function oauthGrantTokenLineage(grantId?: string) {
  return grantId
    ? { OR: [{ grantId }, { referenceId: grantId }] }
    : { grantId: null, referenceId: null };
}

async function hasOAuthRefreshReplayTombstone(
  grant: OAuthUserGrantIdentity & { grantId?: string },
) {
  return Boolean(
    await prisma.oAuthRefreshToken.findFirst({
      where: {
        clientId: grant.clientId,
        userId: grant.userId,
        ...oauthGrantTokenLineage(grant.grantId),
        revoked: { not: null },
        scopes: { has: OAUTH_REFRESH_REPLAY_TOMBSTONE_SCOPE },
      },
      select: { id: true },
    }),
  );
}

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
      referenceId: true,
      revoked: true,
      scopes: true,
      userId: true,
    },
  });
  if (!row || row.revoked || row.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  const grantId = row.grantId ?? row.referenceId ?? undefined;
  const grant = {
    clientId: row.clientId,
    ...(grantId ? { grantId } : {}),
    scopes: row.scopes,
    userId: row.userId,
  };
  const [active, replayed] = await Promise.all([
    hasActiveOAuthUserGrant({
      clientId: row.clientId,
      grantId,
      requireGrantBinding: true,
      scopes: row.scopes,
      userId: row.userId,
    }),
    hasOAuthRefreshReplayTombstone(grant),
  ]);
  if (!active || replayed) return null;

  return grant;
}

export async function isOAuthRefreshGrantActive(
  grant: ActiveOAuthRefreshGrant,
) {
  const [active, replayed] = await Promise.all([
    hasActiveOAuthUserGrant({
      ...grant,
      requireGrantBinding: true,
    }),
    hasOAuthRefreshReplayTombstone(grant),
  ]);
  return active && !replayed;
}

export async function purgeOAuthGrantTokenRows(grant: ActiveOAuthRefreshGrant) {
  const identity = { clientId: grant.clientId, userId: grant.userId };
  const lineage = oauthGrantTokenLineage(grant.grantId);
  await prisma.$transaction(async (tx) => {
    await tx.oAuthAccessToken.deleteMany({
      where: { ...identity, ...lineage },
    });
    await tx.oAuthRefreshToken.deleteMany({
      where: { ...identity, ...lineage, revoked: null },
    });
  });
}

export async function purgeRevokedOAuthRefreshTokenLineage(
  refreshToken: string | null,
) {
  if (!refreshToken) return false;

  const token = await hashOAuthClientSecretForDbStorage(refreshToken);
  return prisma.$transaction(async (tx) => {
    const row = await tx.oAuthRefreshToken.findUnique({
      where: { token },
      select: {
        clientId: true,
        grantId: true,
        id: true,
        referenceId: true,
        revoked: true,
        scopes: true,
        expiresAt: true,
        userId: true,
      },
    });
    if (!row) return false;

    const grantId = row.grantId ?? row.referenceId;
    const identity = { clientId: row.clientId, userId: row.userId };
    const lineage = oauthGrantTokenLineage(grantId ?? undefined);
    const replayed = row.revoked
      ? true
      : Boolean(
          await tx.oAuthRefreshToken.findFirst({
            where: {
              ...identity,
              ...lineage,
              revoked: { not: null },
              scopes: { has: OAUTH_REFRESH_REPLAY_TOMBSTONE_SCOPE },
            },
            select: { id: true },
          }),
        );
    if (!replayed) return false;

    if (
      row.revoked &&
      !row.scopes.includes(OAUTH_REFRESH_REPLAY_TOMBSTONE_SCOPE)
    ) {
      await tx.oAuthRefreshToken.updateMany({
        where: { id: row.id, revoked: { not: null } },
        data: {
          // Better Auth computes a replacement token's expiry before its
          // rotation CAS, so this marker outlives any racing replacement.
          expiresAt: new Date(
            Math.max(
              row.expiresAt.getTime(),
              Date.now() + OAUTH_REFRESH_TOKEN_EXPIRES_IN_SECONDS * 1000,
            ),
          ),
          scopes: [...row.scopes, OAUTH_REFRESH_REPLAY_TOMBSTONE_SCOPE],
        },
      });
    }
    if (grantId) {
      await tx.oAuthConsent.updateMany({
        where: { ...identity, grantId },
        data: { grantId: crypto.randomUUID() },
      });
    }
    await tx.oAuthAccessToken.deleteMany({
      where: { ...identity, ...lineage },
    });
    await tx.oAuthRefreshToken.deleteMany({
      where: { ...identity, ...lineage, revoked: null },
    });
    return true;
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
  await tx.oAuthGrantUsageDaily.deleteMany({ where: identity });
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
  audit: OAuthAuthorizationAuditContext = SYSTEM_OAUTH_AUDIT_CONTEXT,
): Promise<UpdateUserOAuthAuthorizationScopesResult> {
  const normalizedScopes = [...new Set(scopes)].sort();
  return prisma.$transaction(async (tx) => {
    const consent = await tx.oAuthConsent.findFirst({
      where: {
        id: consentId,
        userId,
        client: NONTRUSTED_OAUTH_CLIENT_WHERE,
      },
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
    if (!grantId) return { ok: false, reason: "not_found" };
    await writeAuditLog(
      {
        action: "oauth_authorization_update",
        oauthClientId: consent.clientId,
        oauthGrantId: grantId,
        subjectUserId: userId,
        targetId: consentId,
        targetType: "oauth_consent",
        userId,
        metadata: {
          changedFields: ["scopes"],
          scopeCount: normalizedScopes.length,
        },
        ...audit,
      },
      tx,
    );
    return { ok: true, consentId, grantId, scopes: normalizedScopes };
  });
}

export async function rotateOAuthUserGrantAfterConsent(input: {
  clientId: string;
  scopes: readonly string[];
  userId: string;
}) {
  const scopes = [...new Set(input.scopes)].sort();
  return prisma.$transaction(async (tx) => {
    const client = await tx.oAuthClient.findUnique({
      where: { clientId: input.clientId },
      select: { disabled: true, skipConsent: true },
    });
    if (!client || client.disabled) return null;
    if (client.skipConsent === true) {
      await tx.oAuthConsent.deleteMany({
        where: { clientId: input.clientId, userId: input.userId },
      });
      return { kind: "trusted" as const };
    }

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
    return grantId
      ? {
          consentId: consent.id,
          grantId,
          kind: "consent" as const,
          scopes,
        }
      : null;
  });
}
