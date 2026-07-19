import { prisma } from "@/lib/db/prisma";

export type OAuthUserGrantIdentity = {
  clientId: string;
  userId: string;
};

/**
 * Resource-bound access tokens are stateless JWTs, so signature verification
 * alone cannot observe a user revoking an OAuth application.
 *
 * Keep this check uncached: revocation is expected to take effect on the next
 * protected request. Database failures intentionally reject the request.
 */
export async function hasActiveOAuthUserGrant({
  clientId,
  userId,
}: OAuthUserGrantIdentity): Promise<boolean> {
  if (!clientId || !userId) return false;

  const client = await prisma.oAuthClient.findUnique({
    where: { clientId },
    select: {
      disabled: true,
      skipConsent: true,
      consents: {
        where: { userId },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!client || client.disabled) return false;

  if (client.skipConsent === true) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    return Boolean(user);
  }

  return client.consents.length > 0;
}
