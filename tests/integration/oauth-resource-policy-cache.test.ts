import { expect, vi } from "vitest";
import { tokenPostRoute } from "@/lib/api/routes/auth-token";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { getCanonicalOAuthIssuer } from "@/lib/oauth/resource-urls";
import {
  oauthObservationTest,
  tokenRequest,
} from "../shared/oauth-observation-fixture";

const origin = "http://localhost:3000";

oauthObservationTest(
  "oauth.provider-resource-policy-cache",
  { tags: ["@OAuth/OAuth"] },
  async ({
    isolatedDatabase: { owner: db },
    observation,
    observationRuntime,
  }) => {
    await observationRuntime.run(async () => {
      const { clientId, marker, cookie } = observation;
      const auth = getBetterAuthInstance();
      const context = await auth.$context;
      const resource = getCanonicalOAuthIssuer();
      const headers = new Headers({ cookie, origin });
      const lookup = vi.spyOn(context.adapter, "findOne");
      const creates = vi.spyOn(context.adapter, "create");
      try {
        async function authorize() {
          const query = new URLSearchParams({
            client_id: clientId,
            redirect_uri: "https://client.example/callback",
            response_type: "code",
            scope: "profile",
            state: marker,
            prompt: "consent",
            code_challenge: "v".repeat(43),
            code_challenge_method: "S256",
            resource,
          });
          return observationRuntime.request(() =>
            auth.handler(
              new Request(`${origin}/api/auth/oauth2/authorize?${query}`, {
                headers,
              }),
            ),
          );
        }
        const first = await authorize();
        expect(first.status).toBe(302);
        expect(first.headers.get("location")).toContain("/oauth/authorize");
        lookup.mockClear();
        creates.mockClear();
        const second = await authorize();
        expect(second.headers.get("location")).toContain("/oauth/authorize");
        expect(
          lookup.mock.calls.filter(
            ([input]) => input.model === "oauthResource",
          ),
        ).toHaveLength(0);
        expect(
          creates.mock.calls.filter(
            ([input]) => input.model === "oauthResource",
          ),
        ).toHaveLength(0);
        await observationRuntime.request(() =>
          auth.api.adminUpdateOAuthResource({
            headers,
            params: { identifier: resource },
            body: { disabled: true },
          }),
        );
        const blocked = await authorize();
        const location = blocked.headers.get("location");
        expect(location, await blocked.clone().text()).not.toContain(
          "/oauth/authorize",
        );
        expect(
          location
            ? new URL(location).searchParams.get("error")
            : (await blocked.json()).error,
        ).toBe("invalid_target");
        await observationRuntime.request(() =>
          auth.api.adminUpdateOAuthResource({
            headers,
            params: { identifier: resource },
            body: { disabled: false },
          }),
        );
        expect((await authorize()).headers.get("location")).toContain(
          "/oauth/authorize",
        );
        const resources = await db.oauthResource.findMany();
        const before = resources.map((row) => ({
          id: row.id,
          createdAt: row.createdAt,
        }));
        creates.mockClear();
        await (
          await observationRuntime.request(() =>
            tokenPostRoute(tokenRequest(clientId)),
          )
        ).text();
        await (
          await observationRuntime.request(() =>
            tokenPostRoute(tokenRequest(clientId)),
          )
        ).text();
        expect(
          creates.mock.calls.filter(
            ([input]) => input.model === "oauthResource",
          ),
        ).toHaveLength(0);
        expect(
          (await db.oauthResource.findMany()).map((row) => ({
            id: row.id,
            createdAt: row.createdAt,
          })),
        ).toEqual(before);
      } finally {
        lookup.mockRestore();
        creates.mockRestore();
      }
    });
  },
);
