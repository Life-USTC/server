import { assertActiveOAuthGrant } from "../shared/oauth-active-grant-scenario";
import { oauthJwksTest } from "../shared/oauth-jwks-server";

oauthJwksTest(
  "oauth.authorization-management.active-user-grant-enforcement GraphQL",
  { timeout: 30000, tags: ["@OAuth/GraphQL"] },
  async ({ isolatedDatabase, oauthRuntime, jwks }) => {
    await assertActiveOAuthGrant("GraphQL", {
      isolatedDatabase,
      oauthRuntime,
      jwks,
    });
  },
);
