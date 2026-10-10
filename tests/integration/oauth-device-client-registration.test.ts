import { expect } from "vitest";
import { registrationTest } from "../shared/oauth-registration-fixture";

const deviceGrant = "urn:ietf:params:oauth:grant-type:device_code";

registrationTest(
  "oauth.dcr-device-only-no-redirect",
  { tags: ["@OAuth/OAuth"] },
  async ({
    isolatedDatabase: { owner: db },
    oauthRuntime,
    registration: { register },
  }) => {
    await oauthRuntime.run(async () => {
      for (const redirects of [undefined, []]) {
        const { response, body } = await register({
          grant_types: [deviceGrant],
          response_types: undefined,
          redirect_uris: redirects,
        });
        expect(response.status, JSON.stringify(body)).toBe(201);
        expect(body).toMatchObject({
          grant_types: [deviceGrant],
          redirect_uris: [],
          token_endpoint_auth_method: "none",
        });
        expect(body.client_secret).toBeUndefined();
        const row = await db.oAuthClient.findUniqueOrThrow({
          where: { clientId: body.client_id },
        });
        expect(row).toMatchObject({
          grantTypes: [deviceGrant],
          redirectUris: [],
          clientSecret: null,
        });
        expect(JSON.stringify(body)).not.toContain(
          "device-registration-callback",
        );
        expect(JSON.stringify(row)).not.toContain(
          "device-registration-callback",
        );
      }
    });
  },
);
