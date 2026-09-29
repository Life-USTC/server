import { expect } from "vitest";
import { restReadScope } from "@/lib/oauth/constants";
import { cimdTest } from "../shared/oauth-cimd-fixture";

const authOrigin = "http://localhost:3000";

cimdTest(
  "supports separately registered dynamic clients",
  async ({
    isolatedDatabase: { owner: fixturePrisma },
    oauthRuntime,
    cimd: { authHandler },
  }) => {
    await oauthRuntime.run(async () => {
      const response = await authHandler(
        new Request(`${authOrigin}/api/auth/oauth2/register`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            client_name: "Integration DCR Client",
            redirect_uris: ["https://client.example/callback"],
            token_endpoint_auth_method: "none",
            grant_types: ["authorization_code", "refresh_token"],
            response_types: ["code"],
            scope: restReadScope("account.profile"),
          }),
        }),
      );

      expect(response.status).toBe(201);
      const body = (await response.json()) as { client_id?: unknown };
      expect(typeof body.client_id).toBe("string");
      if (typeof body.client_id !== "string") {
        throw new Error("Missing registered client_id");
      }
      await expect(
        fixturePrisma.oAuthClient.findUnique({
          where: { clientId: body.client_id },
        }),
      ).resolves.toMatchObject({
        applicationType: "web",
        clientId: body.client_id,
        clientCredentialsScopes: [],
        clientDiscoveryId: null,
        name: "Integration DCR Client",
        tokenEndpointAuthMethod: "none",
      });
    });
  },
);
