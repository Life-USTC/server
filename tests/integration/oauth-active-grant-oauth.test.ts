import { assertActiveOAuthGrant } from "../shared/oauth-active-grant-scenario";
import { oauthJwksTest } from "../shared/oauth-jwks-server";

oauthJwksTest(
  "oauth.authorization-management.active-user-grant-enforcement OAuth",
  { timeout: 30000, tags: ["@OAuth/OAuth"] },
  async ({ isolatedDatabase, oauthRuntime, jwks }) => {
    await assertActiveOAuthGrant("OAuth", {
      isolatedDatabase,
      oauthRuntime,
      jwks,
    });
  },
);
