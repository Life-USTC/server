import { expect } from "vitest";
import { registrationTest } from "../shared/oauth-registration-fixture";

registrationTest(
  "oauth.dcr-rules-from-provider",
  { tags: ["@OAuth/OAuth"] },
  async ({
    isolatedDatabase: { owner: db },
    oauthRuntime,
    registration: { marker, register },
  }) => {
    await oauthRuntime.run(async () => {
      const allowed =
        "openid profile email offline_access account.client-activity:read workspace.todo:read workspace.todo:write";
      const accepted = await register({ scope: allowed });
      expect(accepted.response.status).toBe(201);
      const registeredScopes = (
        await db.oAuthClient.findUniqueOrThrow({
          where: { clientId: accepted.body.client_id },
        })
      ).scopes;
      expect(registeredScopes).toEqual(accepted.body.scope.split(" "));
      expect(registeredScopes).toEqual(
        expect.arrayContaining(allowed.split(" ")),
      );
      expect(registeredScopes.some((scope) => scope.startsWith("admin:"))).toBe(
        false,
      );
      for (const scope of [
        "admin:read",
        "admin:write",
        "account.client-activity:write",
        "mcp:tools",
        "unknown:read",
      ]) {
        const count = await db.oAuthClient.count({
          where: { name: { startsWith: marker } },
        });
        const rejected = await register({ scope: `openid ${scope}` });
        expect(rejected.response.status, scope).toBe(400);
        expect(
          await db.oAuthClient.count({
            where: { name: { startsWith: marker } },
          }),
        ).toBe(count);
      }
      const unsupported = await register({
        grant_types: ["client_credentials"],
      });
      expect(unsupported.response.status).toBe(400);
    });
  },
);
