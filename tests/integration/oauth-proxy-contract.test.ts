import { betterAuth } from "better-auth";
import { genericOAuth } from "better-auth/plugins";
import { expect } from "vitest";
import { buildBetterAuthOptions } from "@/lib/auth/better-auth-options";
import { isolatedDatabaseTest } from "../shared/isolated-database";
import { createNodeRuntime } from "../shared/node-runtime";

const production = "https://production.example";
const preview = "https://preview-unique.example";

type ProxyInstance = {
  handler(request: Request): Promise<Response>;
  passkey:
    | ReturnType<typeof buildBetterAuthOptions>["plugins"][number]
    | undefined;
};
type ProxyFixture = {
  marker: string;
  email: string;
  sharedSecret: string;
  exchanges: Array<{
    code: string;
    redirectURI: string;
    codeVerifier?: string;
  }>;
  instance(origin: string, proxySecret?: string): Promise<ProxyInstance>;
};

const test = isolatedDatabaseTest.extend<{ proxy: ProxyFixture }>({
  proxy: async ({ isolatedDatabase }, use) => {
    const marker = crypto.randomUUID();
    const email = `proxy-${marker}@example.test`;
    const sharedSecret = `shared-proxy-${marker}-encryption-key`;
    const exchanges: ProxyFixture["exchanges"] = [];
    const runtimes: ReturnType<typeof createNodeRuntime>[] = [];
    let closed = false;
    async function instance(origin: string, proxySecret = sharedSecret) {
      if (closed) throw new Error("Proxy fixture is closed");
      const runtime = createNodeRuntime({
        APP_CANONICAL_ORIGIN: production,
        APP_PUBLIC_ORIGIN: origin,
        OAUTH_PROXY_SECRET: proxySecret,
        HYPERDRIVE: { connectionString: isolatedDatabase.connections.app },
        HYPERDRIVE_AUTH: {
          connectionString: isolatedDatabase.connections.auth,
        },
        HYPERDRIVE_MAINTENANCE: {
          connectionString: isolatedDatabase.connections.maintenance,
        },
      });
      // Own initialization and each real handler Response before awaiting them.
      runtimes.push(runtime);
      const { auth, passkey } = await runtime.run(async () => {
        const options = buildBetterAuthOptions();
        const proxy = options.plugins.find(
          (plugin) => plugin.id === "oauth-proxy",
        );
        if (!proxy) throw new Error("Application must install OAuth proxy");
        const auth = betterAuth({
          ...options,
          baseURL: origin,
          secret: `${origin}-${marker}-instance-specific-secret`,
          trustedOrigins: [production, preview],
          plugins: [
            proxy,
            genericOAuth({
              config: [
                {
                  providerId: "contract",
                  clientId: "external-provider-client",
                  clientSecret: "external-provider-secret",
                  accountIssuer: "https://external-provider.example",
                  authorizationUrl:
                    "https://external-provider.example/authorize",
                  tokenUrl: "https://external-provider.example/token",
                  pkce: true,
                  getToken: async (input) => {
                    exchanges.push(input);
                    return {
                      accessToken: "upstream-private-access",
                      scopes: ["profile"],
                    };
                  },
                  getUserInfo: async () => ({
                    id: marker,
                    email,
                    emailVerified: true,
                    name: "Proxy contract user",
                  }),
                },
              ],
            }),
          ],
        });
        await auth.$context;
        return {
          auth,
          passkey: options.plugins.find((plugin) => plugin.id === "passkey"),
        };
      });
      return {
        handler: (request: Request) => runtime.run(() => auth.handler(request)),
        passkey,
      };
    }
    const failures: unknown[] = [];
    try {
      await use({ marker, email, sharedSecret, exchanges, instance });
    } catch (error) {
      failures.push(error);
    } finally {
      closed = true;
      const results = await Promise.allSettled(runtimes.map((r) => r.close()));
      failures.push(
        ...results.flatMap((r) => (r.status === "rejected" ? [r.reason] : [])),
      );
    }
    if (failures.length)
      throw new AggregateError(failures, "Proxy runtime cleanup failed");
  },
});

test("oauth.oauth-proxy-for-dev", async ({ isolatedDatabase, proxy }) => {
  const db = isolatedDatabase.owner;
  const { marker, email, sharedSecret, exchanges, instance } = proxy;
  const current = await instance(preview);
  const configured = current.passkey;
  if (!configured || !("options" in configured))
    throw new Error("Expected configured Passkey plugin");
  expect(configured.options).toMatchObject({
    rpID: "preview-unique.example",
    origin: [preview],
  });
  const canonical = await instance(production);
  const wrongKey = await instance(preview, `incorrect-${sharedSecret}`);
  const signIn = await current.handler(
    new Request(`${preview}/api/auth/sign-in/social`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: preview },
      body: JSON.stringify({
        provider: "contract",
        callbackURL: `${preview}/workspace`,
      }),
    }),
  );
  expect(signIn.status, await signIn.clone().text()).toBe(200);
  const providerUrl = new URL((await signIn.json()).url);
  expect(providerUrl.origin).toBe("https://external-provider.example");
  expect(providerUrl.searchParams.get("redirect_uri")).toBe(
    `${production}/api/auth/callback/contract`,
  );
  expect(providerUrl.searchParams.get("code_challenge_method")).toBe("S256");
  const state = providerUrl.searchParams.get("state");
  if (!state) throw new Error("Expected encrypted proxy state");
  expect(state).not.toContain(preview);
  const callbackUrl = new URL(`${production}/api/auth/callback/contract`);
  callbackUrl.searchParams.set("state", state);
  callbackUrl.searchParams.set("code", "external-authorization-code");
  const callback = await canonical.handler(new Request(callbackUrl));
  expect(callback.status, await callback.clone().text()).toBe(302);
  const returnUrl = new URL(callback.headers.get("location") ?? "");
  expect(returnUrl.origin).toBe(preview);
  expect(returnUrl.pathname).toBe("/api/auth/oauth-proxy-callback");
  expect(returnUrl.searchParams.get("callbackURL")).toBe(
    `${preview}/workspace`,
  );
  const profile = returnUrl.searchParams.get("profile");
  expect(profile).toBeTruthy();
  expect(returnUrl.href).not.toContain(email);
  expect(returnUrl.href).not.toContain("upstream-private-access");
  expect(exchanges).toEqual([
    expect.objectContaining({
      code: "external-authorization-code",
      redirectURI: `${production}/api/auth/callback/contract`,
      codeVerifier: expect.any(String),
    }),
  ]);
  expect(await db.user.count({ where: { email } })).toBe(0);

  const denied = await wrongKey.handler(new Request(returnUrl));
  expect(denied.status).toBe(302);
  expect(
    new URL(denied.headers.get("location") ?? "").searchParams.get("error"),
  ).toBe("invalid_profile");
  expect(await db.user.count({ where: { email } })).toBe(0);
  const result = await current.handler(new Request(returnUrl));
  expect(result.status, await result.clone().text()).toBe(302);
  expect(result.headers.get("location")).toBe(`${preview}/workspace`);
  expect(result.headers.get("set-cookie")).toContain("session_token=");
  const account = await db.account.findUniqueOrThrow({
    where: {
      issuer_providerAccountId: {
        issuer: "https://external-provider.example",
        providerAccountId: marker,
      },
    },
  });
  expect(
    await db.user.findUniqueOrThrow({ where: { id: account.userId } }),
  ).toMatchObject({ email });
  const sessionCount = await db.session.count({
    where: { userId: account.userId },
  });
  expect(sessionCount).toBe(1);
  const replay = await current.handler(new Request(returnUrl));
  expect(replay.status).toBe(302);
  expect(
    new URL(replay.headers.get("location") ?? "").searchParams.get("error"),
  ).toBe("state_mismatch");
  expect(await db.session.count({ where: { userId: account.userId } })).toBe(
    sessionCount,
  );
  expect(await db.user.count()).toBe(1);
  expect(await db.account.count()).toBe(1);
  expect(await db.session.count()).toBe(1);
});
