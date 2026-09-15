import { authPrisma } from "@/lib/db/auth-prisma";

/** Load registered redirect URIs for an OAuth client id. */
export async function getOAuthClientRedirectUris(clientId: string) {
  const client = await authPrisma.oAuthClient.findUnique({
    where: { clientId },
    select: { redirectUris: true },
  });
  return client?.redirectUris ?? null;
}
