import { expect } from "@playwright/test";
import { type OAuthState, test as oauthTest } from "./_fixture";

async function loopbackHelpers({ origin, request, session }: OAuthState) {
  const marker = crypto.randomUUID();
  const verifier = "v".repeat(64);
  const challenge = Buffer.from(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
  ).toString("base64url");
  async function register(redirectUri: string) {
    const response = await request.post("/api/auth/oauth2/register", {
      data: {
        client_name: `Loopback ${marker}`,
        application_type: "native",
        redirect_uris: [redirectUri],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code"],
        response_types: ["code"],
        scope: "profile",
      },
    });
    expect(response.status(), await response.text()).toBe(201);
    return (await response.json()).client_id as string;
  }
  async function authorize(clientId: string, redirectUri: string) {
    const query = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "profile",
      state: marker,
      prompt: "consent",
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    const response = await session.get(`/api/auth/oauth2/authorize?${query}`, {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(302);
    return new URL(response.headers().location, origin);
  }
  async function consent(signed: URLSearchParams) {
    const response = await session.post("/oauth/authorize?/consent", {
      form: { accept: "true", scope: "profile", oauthQuery: signed.toString() },
      headers: { origin, accept: "text/html" },
      maxRedirects: 0,
    });
    expect(response.status(), await response.text()).toBe(303);
    return new URL(response.headers().location, origin);
  }
  async function exchange(clientId: string, code: string, redirectUri: string) {
    const response = await request.post("/api/auth/oauth2/token", {
      form: {
        client_id: clientId,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: verifier,
      },
    });
    return { response, body: await response.json() };
  }
  return { origin, register, authorize, consent, exchange };
}
const test = oauthTest.extend<{
  loopback: Awaited<ReturnType<typeof loopbackHelpers>>;
}>({
  loopback: async ({ oauth }, use) => {
    await use(await loopbackHelpers(oauth));
  },
});

test.describe("oauth.loopback-redirect-tolerance", () => {
  for (const host of ["127.0.0.1", "[::1]", "localhost"]) {
    const registered = `http://${host}:61000/callback?instance=desktop`;
    test(`completes registered ${host} callbacks with allowed ports`, async ({
      loopback,
    }) => {
      const { register, authorize, consent, exchange } = loopback;
      const clientId = await register(registered);
      const allowed =
        host === "localhost"
          ? [registered]
          : [registered, registered.replace(":61000", ":62000")];
      for (const redirectUri of allowed) {
        const page = await authorize(clientId, redirectUri);
        expect(page.pathname).toBe("/oauth/authorize");
        expect(page.searchParams.get("redirect_uri")).toBe(redirectUri);
        const callback = await consent(page.searchParams);
        const code = callback.searchParams.get("code");
        expect(code, callback.toString()).toBeTruthy();
        expect(callback.origin).toBe(new URL(redirectUri).origin);
        expect(callback.pathname).toBe("/callback");
        expect(callback.searchParams.get("instance")).toBe("desktop");
        if (!code) throw new Error("Missing authorization code");
        const issued = await exchange(clientId, code, redirectUri);
        expect(issued.response.status(), JSON.stringify(issued.body)).toBe(200);
        expect(typeof issued.body.access_token).toBe("string");
      }
    });
    test(`rejects unregistered ${host} callback components`, async ({
      loopback,
    }) => {
      const { origin, register, authorize } = loopback;
      const clientId = await register(registered);
      const replacements = [
        registered.replace(
          host,
          host === "localhost" ? "127.0.0.1" : "localhost",
        ),
        registered.replace("/callback", "/other"),
        registered.replace("instance=desktop", "instance=other"),
        registered.replace("http:", "https:"),
        ...(host === "localhost"
          ? [registered.replace(":61000", ":62000")]
          : []),
      ];
      for (const rejectedUri of replacements) {
        const rejected = await authorize(clientId, rejectedUri);
        expect(rejected.searchParams.get("error"), rejectedUri).toBe(
          "invalid_redirect",
        );
        expect(rejected.searchParams.get("code")).toBeNull();
        expect(rejected.origin).toBe(origin);
      }
    });
    test(`binds ${host} token exchange to the authorized URI`, async ({
      loopback,
    }) => {
      const { register, authorize, consent, exchange } = loopback;
      const clientId = await register(registered);
      // The exchange must match the URI authorized with the code, including its port.
      for (const changed of [
        registered.replace(
          host,
          host === "localhost" ? "127.0.0.1" : "localhost",
        ),
        registered.replace(":61000", ":62001"),
      ]) {
        const page = await authorize(clientId, registered);
        const callback = await consent(page.searchParams);
        const code = callback.searchParams.get("code");
        if (!code) throw new Error("Missing authorization code");
        const denied = await exchange(clientId, code, changed);
        expect(denied.response.status()).toBe(400);
        expect(denied.body.access_token).toBeUndefined();
      }
    });
  }
});
