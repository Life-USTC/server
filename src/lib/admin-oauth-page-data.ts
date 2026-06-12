import { getPrismaClient, requireAdminPage } from "@/lib/admin-page-auth";
import {
  OAUTH_CLIENT_SECRET_BASIC_AUTH_METHOD,
  OAUTH_CLIENT_SECRET_POST_AUTH_METHOD,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
} from "@/lib/oauth/constants";
import { toLoadData } from "@/lib/page-data-utils";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";

export async function getAdminOAuthPage(request: Request) {
  await requireAdminPage(request);
  const prisma = await getPrismaClient();
  const clients = await prisma.oAuthClient.findMany({
    select: {
      clientId: true,
      name: true,
      tokenEndpointAuthMethod: true,
      redirectUris: true,
      scopes: true,
      grantTypes: true,
      responseTypes: true,
      public: true,
      requirePKCE: true,
      skipConsent: true,
      disabled: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return toLoadData({
    clients: clients.map((client) => ({
      ...client,
      tokenEndpointAuthMethod:
        client.tokenEndpointAuthMethod ?? OAUTH_CLIENT_SECRET_BASIC_AUTH_METHOD,
      createdAt: toShanghaiIsoString(client.createdAt),
    })),
    authMethods: [
      OAUTH_CLIENT_SECRET_BASIC_AUTH_METHOD,
      OAUTH_CLIENT_SECRET_POST_AUTH_METHOD,
      OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
    ],
  });
}
