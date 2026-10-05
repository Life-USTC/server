import { betterAuth } from "better-auth";
import { buildBetterAuthOptions } from "@/lib/auth/better-auth-options";
import { restReadScope } from "@/lib/oauth/constants";
import { oauthProviderTest } from "../shared/oauth-provider-runtime";

const authOrigin = "http://localhost:3000";

oauthProviderTest(
  "supports separately registered dynamic clients",
  { tags: ["@OAuth/OAuth"] },
  async ({
    isolatedDatabase: { owner: fixturePrisma },
    oauthRuntime,
    expect,
  }) => {
    await oauthRuntime.run(async () => {
      const options = buildBetterAuthOptions();
      const auth = betterAuth({
        ...options,
        plugins: options.plugins.filter((plugin) =>
          ["jwt", "oauth-provider", "cimd"].includes(plugin.id),
        ),
      });
      await auth.$context;
      const response = await oauthRuntime.request(() =>
        auth.handler(
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
        ),
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
