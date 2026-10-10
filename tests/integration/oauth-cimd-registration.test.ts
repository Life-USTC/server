import { expect, vi } from "vitest";
import {
  OAUTH_DEVICE_CODE_GRANT_TYPE,
  restReadScope,
} from "@/lib/oauth/constants";
import { cimdTest } from "../shared/oauth-cimd-fixture";

cimdTest(
  "oauth.llm-platform-oauth-compatibility",
  { tags: ["@OAuth/OAuth"], timeout: 20_000 },
  async ({
    isolatedDatabase: { owner: fixturePrisma },
    oauthRuntime,
    cimd,
  }) => {
    await oauthRuntime.run(async () => {
      const { metadataByUrl, responsesByUrl, authorizeRequest, resolve4 } =
        cimd;
      const baseline = {
        client_name: "Integration MCP Client",
        redirect_uris: ["https://client.example/callback"],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        scope: restReadScope("account.profile"),
      };
      function clientId(scenario: string, scheme = "https") {
        const id = `${scheme}://client.example/${scenario}-${crypto.randomUUID()}.json`;
        return id;
      }
      async function rejects(id: string, description?: string) {
        const response = await authorizeRequest(id);
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe("invalid_client");
        if (description) expect(body.error_description).toContain(description);
        await expect(
          fixturePrisma.oAuthClient.findUnique({ where: { clientId: id } }),
        ).resolves.toBeNull();
      }

      // Exercise installed provider validation, never a replica of its validators.
      for (const [scenario, overrides] of [
        ["missing-name", { client_name: undefined }],
        ["blank-name", { client_name: "  " }],
        ["wrong-id", { client_id: "https://other.example/client.json" }],
        ["missing-redirects", { redirect_uris: undefined }],
        ["empty-redirects", { redirect_uris: [] }],
        ["relative-redirect", { redirect_uris: ["/callback"] }],
        ["dpop", { dpop_bound_access_tokens: true }],
        ["device-only", { grant_types: [OAUTH_DEVICE_CODE_GRANT_TYPE] }],
        ["service-account", { grant_types: ["client_credentials"] }],
        [
          "shared-secret",
          { token_endpoint_auth_method: "client_secret_basic" },
        ],
      ] as const) {
        const id = clientId(scenario);
        metadataByUrl.set(id, { ...baseline, client_id: id, ...overrides });
        await rejects(id);
      }
      const insecureId = clientId("insecure", "http");
      const callsBeforeInsecure = vi.mocked(globalThis.fetch).mock.calls.length;
      const insecureResponse = await authorizeRequest(insecureId);
      expect(insecureResponse.status).toBe(302);
      const insecureLocation = new URL(
        insecureResponse.headers.get("location") ?? "",
      );
      expect(
        insecureLocation.searchParams.get("error"),
        insecureLocation.href,
      ).toBe("invalid_client");
      await expect(
        fixturePrisma.oAuthClient.findUnique({
          where: { clientId: insecureId },
        }),
      ).resolves.toBeNull();
      expect(globalThis.fetch).toHaveBeenCalledTimes(callsBeforeInsecure);

      // DNS and remote bodies are controlled; provider, fetch policy, and DB are real.
      for (const addresses of [["127.0.0.1"], ["8.8.8.8", "10.0.0.1"], []]) {
        const id = clientId("nonpublic-dns");
        vi.mocked(resolve4).mockResolvedValueOnce(addresses);
        const fetchCallsBefore = vi.mocked(globalThis.fetch).mock.calls.length;
        await rejects(id, "fetch policy");
        expect(globalThis.fetch).toHaveBeenCalledTimes(fetchCallsBefore);
      }
      const failedDns = clientId("dns-error");
      vi.mocked(resolve4).mockRejectedValueOnce(new Error("resolver failed"));
      await rejects(failedDns, "fetch policy");

      for (const [scenario, response, description] of [
        [
          "redirect",
          () =>
            new Response(null, {
              status: 302,
              headers: { location: "https://other.example/metadata" },
            }),
          "HTTP 302",
        ],
        [
          "non-json",
          () =>
            new Response("{}", { headers: { "content-type": "text/html" } }),
          "must be JSON",
        ],
        [
          "invalid-json",
          () =>
            new Response("{", {
              headers: { "content-type": "application/json" },
            }),
          "not valid JSON",
        ],
        [
          "oversized-declared",
          () =>
            new Response("{}", {
              headers: {
                "content-type": "application/json",
                "content-length": "5121",
              },
            }),
          "size limit",
        ],
        [
          "oversized-body",
          () =>
            new Response(" ".repeat(5121), {
              headers: { "content-type": "application/json" },
            }),
          "size limit",
        ],
      ] as const) {
        const id = clientId(scenario);
        responsesByUrl.set(id, response);
        await rejects(id, description);
        const lastCall = vi.mocked(globalThis.fetch).mock.calls.at(-1);
        expect(lastCall?.[0]).toBe(id);
        expect(lastCall?.[1]?.redirect).toBe("manual");
      }
      const timeoutId = clientId("slow-body");
      let streamCancelled = false;
      responsesByUrl.set(
        timeoutId,
        () =>
          new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode("{"));
              },
              cancel() {
                streamCancelled = true;
              },
            }),
            { headers: { "content-type": "application/json" } },
          ),
      );
      await rejects(timeoutId, "timed out after 5000ms");
      expect(streamCancelled).toBe(true);

      const id = clientId("accepted");
      metadataByUrl.set(id, {
        ...baseline,
        client_id: id,
        grant_types: [
          "authorization_code",
          "refresh_token",
          OAUTH_DEVICE_CODE_GRANT_TYPE,
          "urn:ietf:params:oauth:grant-type:jwt-bearer",
        ],
      });
      const response = await authorizeRequest(id);
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toContain("/account/sign-in");
      await expect(
        fixturePrisma.oAuthClient.findUnique({ where: { clientId: id } }),
      ).resolves.toMatchObject({
        applicationType: null,
        clientId: id,
        clientCredentialsScopes: [],
        clientDiscoveryId: "cimd",
        clientSecret: null,
        name: baseline.client_name,
        redirectUris: baseline.redirect_uris,
        grantTypes: ["authorization_code", "refresh_token"],
        responseTypes: ["code"],
        tokenEndpointAuthMethod: "none",
        skipConsent: null,
      });
      const withoutPkce = await authorizeRequest(id, false);
      expect(withoutPkce.status).toBe(302);
      const callback = new URL(withoutPkce.headers.get("location") ?? "");
      expect(callback.origin).toBe("https://client.example");
      expect(callback.searchParams.get("error")).toBe("invalid_request");
    });
  },
);
