import { assertActiveOAuthGrant } from "../shared/oauth-active-grant-scenario";
import { oauthJwksTest } from "../shared/oauth-jwks-server";

oauthJwksTest(
  "oauth.authorization-management.active-user-grant-enforcement REST",
  { timeout: 30000, tags: ["@OAuth/REST"] },
  async ({ isolatedDatabase, oauthRuntime, jwks }) => {
    await assertActiveOAuthGrant("REST", {
      isolatedDatabase,
      oauthRuntime,
      jwks,
    });
  },
);
