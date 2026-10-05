import { assertActiveOAuthGrant } from "../shared/oauth-active-grant-scenario";
import { oauthJwksTest } from "../shared/oauth-jwks-server";

oauthJwksTest(
  "oauth.authorization-management.active-user-grant-enforcement Service",
  { timeout: 30000, tags: ["@OAuth/Service"] },
  async ({ isolatedDatabase, oauthRuntime, jwks }) => {
    await assertActiveOAuthGrant("Service", {
      isolatedDatabase,
      oauthRuntime,
      jwks,
    });
  },
);
