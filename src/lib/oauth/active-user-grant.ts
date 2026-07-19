import { prisma } from "@/lib/db/prisma";
import { OAUTH_REFRESH_REPLAY_TOMBSTONE_SCOPE } from "@/lib/oauth/constants";

export type OAuthUserGrantIdentity = {
  clientId: string;
  userId: string;
};

export type OAuthUserGrantEvidence = {
  grantId?: string;
  requireGrantBinding?: boolean;
  scopes?: readonly string[];
};

export type ActiveOAuthUserGrant =
  | { kind: "consent"; consentId: string; grantId: string }
  | { kind: "trusted" };

/**
 * Resource-bound access tokens are stateless JWTs, so signature verification
 * alone cannot observe a user revoking an OAuth application.
 *
 * Keep this check uncached: revocation is expected to take effect on the next
 * protected request. Database failures intentionally reject the request.
 */
export async function resolveActiveOAuthUserGrant({
  clientId,
  grantId,
  requireGrantBinding = false,
  scopes = [],
  userId,
}: OAuthUserGrantIdentity &
  OAuthUserGrantEvidence): Promise<ActiveOAuthUserGrant | null> {
  if (!clientId || !userId) return null;

  const client = await prisma.oAuthClient.findUnique({
    where: { clientId },
    select: {
      disabled: true,
      skipConsent: true,
      consents: {
        where: {
          userId,
          ...(grantId ? { grantId } : {}),
          ...(scopes.length > 0 ? { scopes: { hasEvery: [...scopes] } } : {}),
        },
        select: { grantId: true, id: true },
        take: 1,
      },
    },
  });
  if (!client || client.disabled) return null;

  if (client.skipConsent === true) {
    const [user, replayTombstone] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      }),
      prisma.oAuthRefreshToken.findFirst({
        where: {
          clientId,
          userId,
          // Trusted clients have no persisted consent generation. A replay
          // therefore invalidates their whole legacy null-grant lineage.
          ...(grantId
            ? { OR: [{ grantId }, { referenceId: grantId }] }
            : { grantId: null, referenceId: null }),
          revoked: { not: null },
          scopes: { has: OAUTH_REFRESH_REPLAY_TOMBSTONE_SCOPE },
        },
        select: { id: true },
      }),
    ]);
    return user && !replayTombstone ? { kind: "trusted" } : null;
  }

  if (requireGrantBinding && !grantId) return null;

  const consent = client.consents[0];
  return consent
    ? {
        kind: "consent",
        consentId: consent.id,
        grantId: consent.grantId,
      }
    : null;
}

export async function hasActiveOAuthUserGrant(
  input: OAuthUserGrantIdentity & OAuthUserGrantEvidence,
): Promise<boolean> {
  return Boolean(await resolveActiveOAuthUserGrant(input));
}
