import { authPrisma } from "@/lib/db/auth-prisma";
import { hashOAuthClientSecretForDbStorage } from "@/lib/oauth/utils";

export type OpaqueIntrospectionGrant =
  | {
      clientId: string;
      grantId: string | undefined;
      scopes: string[];
      userId: string;
    }
  | { machine: true };

/**
 * Resolve an opaque (non-JWT) introspection token to its active grant row.
 */
export async function resolveOpaqueIntrospectionGrant(
  token: string,
  tokenTypeHint: string | null,
): Promise<OpaqueIntrospectionGrant | null> {
  const tokenHash = await hashOAuthClientSecretForDbStorage(
    token.replace(/^Bearer /, ""),
  );
  if (!tokenTypeHint || tokenTypeHint === "access_token") {
    const accessToken = await authPrisma.oAuthAccessToken.findUnique({
      where: { token: tokenHash },
      select: {
        clientId: true,
        grantId: true,
        referenceId: true,
        scopes: true,
        userId: true,
      },
    });
    if (accessToken) {
      return accessToken.userId
        ? {
            clientId: accessToken.clientId,
            grantId:
              accessToken.grantId ?? accessToken.referenceId ?? undefined,
            scopes: accessToken.scopes,
            userId: accessToken.userId,
          }
        : { machine: true as const };
    }
  }
  if (!tokenTypeHint || tokenTypeHint === "refresh_token") {
    const refreshToken = await authPrisma.oAuthRefreshToken.findUnique({
      where: { token: tokenHash },
      select: {
        clientId: true,
        grantId: true,
        referenceId: true,
        scopes: true,
        userId: true,
      },
    });
    if (refreshToken) {
      return {
        clientId: refreshToken.clientId,
        grantId: refreshToken.grantId ?? refreshToken.referenceId ?? undefined,
        scopes: refreshToken.scopes,
        userId: refreshToken.userId,
      };
    }
  }
  return null;
}
