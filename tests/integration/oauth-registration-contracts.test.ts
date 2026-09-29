import { expect } from "vitest";
import { registrationTest } from "../shared/oauth-registration-fixture";

registrationTest(
  "oauth.dcr-via-provider",
  async ({
    isolatedDatabase: { owner: db },
    oauthRuntime,
    registration: { marker, register },
  }) => {
    await oauthRuntime.run(async () => {
      const { response, body } = await register();
      expect(response.status, JSON.stringify(body)).toBe(201);
      expect(body).toMatchObject({
        client_name: `${marker}-registration`,
        token_endpoint_auth_method: "none",
        redirect_uris: ["http://127.0.0.1:61000/callback"],
      });
      const row = await db.oAuthClient.findUniqueOrThrow({
        where: { clientId: body.client_id },
      });
      expect(row).toMatchObject({
        name: body.client_name,
        tokenEndpointAuthMethod: "none",
        scopes: body.scope.split(" "),
        redirectUris: body.redirect_uris,
      });
      const count = await db.oAuthClient.count({
        where: { name: { startsWith: marker } },
      });
      const invalid = await register({ dpop_bound_access_tokens: true });
      expect(invalid.response.status).toBe(400);
      expect(invalid.body.error).toBe("invalid_client_metadata");
      expect(
        await db.oAuthClient.count({ where: { name: { startsWith: marker } } }),
      ).toBe(count);
    });
  },
);
