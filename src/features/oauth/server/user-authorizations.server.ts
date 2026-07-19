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

  const authorizations = new Map<string, UserOAuthAuthorization>();
  for (const row of rows) {
    const existing = authorizations.get(row.clientId);
    if (existing) {
      existing.scopes = [
        ...new Set([...existing.scopes, ...row.scopes]),
      ].sort();
      continue;
    }
    authorizations.set(row.clientId, {
      consentId: row.id,
      clientName: row.client.name,
      clientUri: row.client.uri,
      disabled: row.client.disabled,
      scopes: [...new Set(row.scopes)].sort(),
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  return [...authorizations.values()];
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

export type ActiveOAuthRefreshGrant = OAuthUserGrantIdentity;

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
      revoked: true,
      userId: true,
    },
  });
  if (
    !row ||
    row.revoked ||
    row.expiresAt.getTime() <= Date.now() ||
    !(await hasActiveOAuthUserGrant(row))
  ) {
    return null;
  }

  return { clientId: row.clientId, userId: row.userId };
}

export function isOAuthRefreshGrantActive(grant: ActiveOAuthRefreshGrant) {
  return hasActiveOAuthUserGrant(grant);
}

export async function purgeOAuthGrantTokenRows(grant: ActiveOAuthRefreshGrant) {
  await prisma.$transaction(async (tx) => {
    await tx.oAuthAccessToken.deleteMany({ where: grant });
    await tx.oAuthRefreshToken.deleteMany({ where: grant });
  });
}
