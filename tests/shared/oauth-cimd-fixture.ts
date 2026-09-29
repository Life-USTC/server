import { resolve4, resolve6 } from "node:dns/promises";
import { vi } from "vitest";
import { restReadScope } from "@/lib/oauth/constants";
import { oauthProviderTest } from "./oauth-provider-runtime";

vi.mock("node:dns/promises", () => ({
  resolve4: vi.fn(),
  resolve6: vi.fn(),
}));

const authOrigin = "http://localhost:3000";
type CimDNetwork = {
  resolve4: typeof resolve4;
  metadataByUrl: Map<string, Record<string, unknown>>;
  responsesByUrl: Map<string, () => Response>;
};
export const cimdTest = oauthProviderTest.extend<{
  _cimdNetwork: CimDNetwork;
  cimd: CimDNetwork & {
    authHandler: (request: Request) => Promise<Response>;
    authorizeRequest: (
      clientId: string,
      includePkce?: boolean,
    ) => Promise<Response>;
  };
}>({
  _cimdNetwork: async ({ oauthRuntime }, use) => {
    const metadataByUrl = new Map<string, Record<string, unknown>>();
    const responsesByUrl = new Map<string, () => Response>();
    const originalFetch = globalThis.fetch;
    try {
      vi.mocked(resolve4).mockResolvedValue(["8.8.8.8"]);
      vi.mocked(resolve6).mockRejectedValue(
        Object.assign(new Error("no AAAA record"), { code: "ENODATA" }),
      );
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          const url =
            input instanceof Request
              ? input.url
              : input instanceof URL
                ? input.toString()
                : input;
          const controlledResponse = responsesByUrl.get(url);
          if (controlledResponse) return controlledResponse();
          const metadata = metadataByUrl.get(url);
          if (metadata) {
            return Response.json(metadata, {
              headers: { "content-type": "application/json" },
            });
          }
          return originalFetch(input, init);
        }),
      );

      await use({ metadataByUrl, responsesByUrl, resolve4 });
    } finally {
      try {
        // DNS/fetch remain installed while admitted provider calls finish, including
        // response reads and the outer assertions after a runner timeout.
        await oauthRuntime.close();
      } finally {
        vi.unstubAllGlobals();
      }
    }
  },
  cimd: async ({ _cimdNetwork, oauthRuntime }, use) => {
    const auth = await oauthRuntime.run(async () => {
      const [{ betterAuth }, { buildBetterAuthOptions }] = await Promise.all([
        import("better-auth"),
        import("@/lib/auth/better-auth-options"),
      ]);
      const options = buildBetterAuthOptions();
      const auth = betterAuth({
        ...options,
        plugins: options.plugins.filter((plugin) =>
          ["jwt", "oauth-provider", "cimd"].includes(plugin.id),
        ),
      });
      await auth.$context;
      return auth;
    });
    const authHandler = (request: Request) =>
      oauthRuntime.request(() => auth.handler(request));
    function authorizeRequest(clientId: string, includePkce = true) {
      const url = new URL("/api/auth/oauth2/authorize", authOrigin);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", "https://client.example/callback");
      url.searchParams.set("scope", restReadScope("account.profile"));
      if (includePkce) {
        url.searchParams.set(
          "code_challenge",
          "0ZTVJ3y8iV5f0fIArEGRm8H8q_TfQXQGGVQnXKgV3Q4",
        );
        url.searchParams.set("code_challenge_method", "S256");
      }
      return authHandler(new Request(url));
    }

    await use({ ..._cimdNetwork, authHandler, authorizeRequest });
  },
});
