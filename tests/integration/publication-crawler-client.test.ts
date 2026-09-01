import {
  OAUTH_DEVICE_CODE_GRANT_TYPE,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
  OAUTH_REFRESH_TOKEN_GRANT_TYPE,
  PUBLICATION_CRAWLER_OAUTH_CLIENT_ID,
  PUBLICATION_CRAWLER_OAUTH_CLIENT_SCOPES,
} from "@/lib/oauth/constants";
import { createTestPrisma, disconnectTestPrisma } from "../shared/prisma";

const prisma = createTestPrisma();

describe("provisioned publication crawler OAuth client", () => {
  afterAll(async () => {
    await disconnectTestPrisma(prisma);
  });

  it("has the fixed public device-flow security contract", async () => {
    const client = await prisma.oAuthClient.findUnique({
      where: { clientId: PUBLICATION_CRAWLER_OAUTH_CLIENT_ID },
      select: {
        applicationType: true,
        clientSecret: true,
        disabled: true,
        dpopBoundAccessTokens: true,
        grantTypes: true,
        redirectUris: true,
        requirePKCE: true,
        scopes: true,
        tokenEndpointAuthMethod: true,
      },
    });

    expect(client).toEqual({
      applicationType: "native",
      clientSecret: null,
      disabled: false,
      dpopBoundAccessTokens: false,
      grantTypes: [
        OAUTH_DEVICE_CODE_GRANT_TYPE,
        OAUTH_REFRESH_TOKEN_GRANT_TYPE,
      ],
      redirectUris: [],
      requirePKCE: false,
      scopes: [...PUBLICATION_CRAWLER_OAUTH_CLIENT_SCOPES],
      tokenEndpointAuthMethod: OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
    });
  });
});
