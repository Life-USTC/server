import { exportJWK, generateKeyPair, type JWK, SignJWT } from "jose";
import { expect, vi } from "vitest";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { nodeHttpTest } from "./node-http-contract-fixture";

type SocialNetwork = {
  marker: string;
  email: string;
  oidcSubject: string;
  origin: string;
  upstreamTokenRequests: number;
  upstreamName: string;
  upstreamImage: string;
};

export const socialCookies = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .filter((value) => value.slice(value.indexOf("=") + 1).length > 0)
    .join("; ");

// Each consumer has one native case in an isolated runner file. The real auth
// singleton, provider fetch and library rate-limit memory require that boundary;
// private databases alone do not make concurrent tests in one realm safe.
export const socialLoginTest = nodeHttpTest
  .extend({
    protocolBindings: {
      // An empty canonical override uses this case's configured public origin.
      APP_CANONICAL_ORIGIN: "",
      AUTH_GITHUB_ID: "social-contract-client",
      AUTH_GITHUB_SECRET: "social-contract-secret",
      AUTH_GOOGLE_ID: "google-contract-client",
      AUTH_GOOGLE_SECRET: "google-contract-secret",
      AUTH_OIDC_CLIENT_ID: "oidc-contract-client",
      AUTH_OIDC_CLIENT_SECRET: "oidc-contract-secret",
      AUTH_OIDC_ISSUER: "https://oidc.example.test",
    },
  })
  .extend<{
    socialIp: string;
    _socialNetwork: SocialNetwork;
  }>({
    socialIp: "192.0.2.1",
    _socialNetwork: async ({ protocolRuntime }, use) => {
      const marker = crypto.randomUUID();
      const network: SocialNetwork = {
        marker,
        email: `${marker}@social-contract.test`,
        oidcSubject: `oidc-${marker}`,
        origin: "",
        upstreamTokenRequests: 0,
        upstreamName: "Upstream profile",
        upstreamImage: "https://example.test/upstream-avatar.png",
      };
      const nativeFetch = globalThis.fetch;
      let google: Promise<{ token: string; jwk: JWK }> | undefined;
      function googleCredentials() {
        // The provider's owned HTTP request awaits this work; GitHub-only cases
        // never generate keys, and token/certs requests share the same pair.
        google ??= (async () => {
          const keys = await generateKeyPair("RS256");
          const jwk = {
            ...(await exportJWK(keys.publicKey)),
            kid: "social-contract-key",
            alg: "RS256",
            use: "sig",
          };
          const token = await new SignJWT({
            sub: `google-${marker}`,
            name: "Google profile",
            email: `google-${network.email}`,
            email_verified: true,
          })
            .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
            .setIssuer("https://accounts.google.com")
            .setAudience("google-contract-client")
            .setIssuedAt()
            .setExpirationTime("5m")
            .sign(keys.privateKey);
          return { token, jwk };
        })();
        return google;
      }
      try {
        vi.stubGlobal(
          "fetch",
          async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(
              input instanceof Request ? input.url : String(input),
            );
            if (
              url.hostname === "github.com" &&
              url.pathname === "/login/oauth/access_token"
            ) {
              network.upstreamTokenRequests++;
              return Response.json({
                access_token: "controlled-upstream-token",
                token_type: "bearer",
                scope: "read:user user:email",
              });
            }
            if (url.hostname === "api.github.com" && url.pathname === "/user")
              return Response.json({
                id: 1900260927,
                login: "social-contract",
                name: network.upstreamName,
                email: network.email,
                avatar_url: network.upstreamImage,
              });
            if (
              url.hostname === "api.github.com" &&
              url.pathname === "/user/emails"
            )
              return Response.json([
                {
                  email: network.email,
                  primary: true,
                  verified: true,
                  visibility: "public",
                },
              ]);
            if (url.href === "https://oauth2.googleapis.com/token") {
              const { token } = await googleCredentials();
              return Response.json({
                access_token: "google-controlled-token",
                id_token: token,
                token_type: "Bearer",
                expires_in: 300,
              });
            }
            if (url.href === "https://www.googleapis.com/oauth2/v3/certs") {
              const { jwk } = await googleCredentials();
              return Response.json({ keys: [jwk] });
            }
            if (url.href === "https://oidc.example.test/token/")
              return Response.json({
                access_token: "oidc-controlled-token",
                token_type: "Bearer",
                expires_in: 300,
              });
            if (url.href === "https://oidc.example.test/userinfo/")
              return Response.json({
                sub: network.oidcSubject,
                name: "USTC profile",
              });
            if (url.origin === network.origin) return nativeFetch(input, init);
            throw new Error(
              `Unexpected provider request: ${url.origin}${url.pathname}`,
            );
          },
        );
        // Register restoration before auth setup or provider requests can time out.
        await use(network);
      } finally {
        // httpHandler depends on this fixture, so HTTP closes before restoration.
        // Await borrowed cleanup; the runtime owner reports its original failure.
        await Promise.allSettled([protocolRuntime.close()]);
        vi.unstubAllGlobals();
      }
    },
  })
  .extend({
    httpHandler: async ({ _socialNetwork, socialIp }, use) => {
      await use((request: Request) => {
        if (new URL(request.url).origin !== _socialNetwork.origin)
          throw new Error("Unexpected social callback origin");
        // One stable address per scenario preserves the real per-IP limiter.
        request.headers.set("cf-connecting-ip", socialIp);
        return getBetterAuthInstance().handler(request);
      });
    },
  })
  .extend(
    "social",
    async ({
      http,
      isolatedDatabase,
      protocolRuntime,
      _socialNetwork,
    }) => {
      protocolRuntime.setPublicOrigin(http.origin);
      _socialNetwork.origin = http.origin;
      const { marker, email, oidcSubject } = _socialNetwork;
      await protocolRuntime.run(async () => {
        // Production actions and the HTTP handler must share this real instance.
        await getBetterAuthInstance().$context;
      });
      const { origin, fetch } = http;
      async function start() {
        const response = await fetch(`${origin}/api/auth/sign-in/social`, {
          method: "POST",
          headers: { "content-type": "application/json", origin },
          body: JSON.stringify({
            provider: "github",
            callbackURL: `${origin}/catalog/courses?from=oauth`,
            disableRedirect: true,
          }),
        });
        expect(response.status).toBe(200);
        const authorization = new URL((await response.json()).url);
        expect(authorization.origin).toBe("https://github.com");
        expect(authorization.searchParams.get("redirect_uri")).toBe(
          `${origin}/api/auth/callback/github`,
        );
        const state = authorization.searchParams.get("state");
        expect(state).toBeTruthy();
        return { state: state as string, cookie: socialCookies(response) };
      }
      return {
        db: isolatedDatabase.owner,
        marker,
        email,
        oidcSubject,
        network: _socialNetwork,
        origin,
        fetch,
        start,
        run: protocolRuntime.run,
        request: protocolRuntime.request,
      };
    },
  );
