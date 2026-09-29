import { expect } from "vitest";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { registrationTest } from "../shared/oauth-registration-fixture";

const origin = "http://localhost:3000";

registrationTest(
  "oauth.public-clients-pkce",
  async ({
    isolatedDatabase: { owner: db },
    oauthRuntime,
    registration: { marker, register },
  }) => {
    await oauthRuntime.run(async () => {
      const registered = await register();
      expect(registered.response.status).toBe(201);
      expect(registered.body.client_secret).toBeUndefined();
      expect(
        await db.oAuthClient.findUniqueOrThrow({
          where: { clientId: registered.body.client_id },
        }),
      ).toMatchObject({
        tokenEndpointAuthMethod: "none",
        clientSecret: null,
      });
      const query = new URLSearchParams({
        client_id: registered.body.client_id,
        response_type: "code",
        redirect_uri: "http://127.0.0.1:61000/callback",
        scope: "openid profile",
        state: marker,
      });
      for (const challenge of [
        null,
        { code_challenge: "challenge", code_challenge_method: "plain" },
        { code_challenge: "a".repeat(43), code_challenge_method: "S256" },
      ]) {
        const params = new URLSearchParams(query);
        if (challenge)
          for (const [name, value] of Object.entries(challenge))
            params.set(name, value);
        const response = await oauthRuntime.request(() =>
          getBetterAuthInstance().handler(
            new Request(`${origin}/api/auth/oauth2/authorize?${params}`),
          ),
        );
        expect(response.status).toBe(302);
        const location = new URL(response.headers.get("location")!);
        if (challenge?.code_challenge_method === "S256")
          expect(location.pathname).toBe("/account/sign-in");
        else expect(location.searchParams.get("error")).toBeTruthy();
      }
    });
  },
);
