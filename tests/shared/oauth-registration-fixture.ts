import { authPostRoute } from "@/lib/api/routes/auth";
import { oauthProviderTest } from "./oauth-provider-runtime";

const origin = "http://localhost:3000";

export const registrationTest = oauthProviderTest
  .extend({ oauthEnvironment: { E2E_DEBUG_AUTH: "1" } })
  .extend("registration", async ({ oauthRuntime }) => {
    const marker = crypto.randomUUID();
    async function register(overrides: Record<string, unknown> = {}) {
      return oauthRuntime.request(async () => {
        const request = new Request(`${origin}/api/auth/oauth2/register`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            client_name: `${marker}-registration`,
            application_type: "native",
            redirect_uris: ["http://127.0.0.1:61000/callback"],
            token_endpoint_auth_method: "none",
            grant_types: ["authorization_code", "refresh_token"],
            response_types: ["code"],
            scope: "openid profile workspace.todo:read",
            ...overrides,
          }),
        });
        const response = await authPostRoute(request);
        const body = await response.json();
        return { response, body };
      });
    }
    return { marker, register };
  });
