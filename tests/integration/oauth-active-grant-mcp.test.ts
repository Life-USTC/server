import { assertActiveOAuthGrant } from "../shared/oauth-active-grant-scenario";
import { oauthJwksTest } from "../shared/oauth-jwks-server";

oauthJwksTest(
  "oauth.authorization-management.active-user-grant-enforcement MCP",
  { timeout: 30000, tags: ["@OAuth/MCP"] },
  async ({ isolatedDatabase, oauthRuntime, jwks }) => {
    await assertActiveOAuthGrant("MCP", {
      isolatedDatabase,
      oauthRuntime,
      jwks,
    });
  },
);
