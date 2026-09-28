import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { authPostRoute } from "@/lib/api/routes/auth";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const marker = crypto.randomUUID();
const clients: string[] = [];
const origin = "http://localhost:3000";
const deviceGrant = "urn:ietf:params:oauth:grant-type:device_code";
async function register(overrides: Record<string, unknown> = {}) {
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
  if (typeof body.client_id === "string") clients.push(body.client_id);
  return { response, body };
}
beforeAll(() => {
  vi.stubEnv("E2E_DEBUG_AUTH", "1");
});
afterAll(async () => {
  await db.oAuthClient.deleteMany({
    where: {
      OR: [{ clientId: { in: clients } }, { name: { startsWith: marker } }],
    },
  });
  await db.$disconnect();
  vi.unstubAllEnvs();
});

it("oauth.dcr-via-provider", async () => {
  const { response, body } = await register();
  expect(response.status, JSON.stringify(body)).toBe(201);
  expect(body).toMatchObject({
    client_name: `${marker}-registration`,
    token_endpoint_auth_method: "none",
    redirect_uris: ["http://127.0.0.1:61000/callback"],
  });
  const row = await db.oAuthClient.findUniqueOrThrow({
    where: { clientId: body.client_id },
  });
  expect(row).toMatchObject({
    name: body.client_name,
    tokenEndpointAuthMethod: "none",
    scopes: body.scope.split(" "),
    redirectUris: body.redirect_uris,
  });
  const count = await db.oAuthClient.count({
    where: { name: { startsWith: marker } },
  });
  const invalid = await register({ dpop_bound_access_tokens: true });
  expect(invalid.response.status).toBe(400);
  expect(invalid.body.error).toBe("invalid_client_metadata");
  expect(
    await db.oAuthClient.count({ where: { name: { startsWith: marker } } }),
  ).toBe(count);
});

it("oauth.dcr-device-only-no-redirect", async () => {
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
    expect(JSON.stringify(body)).not.toContain("device-registration-callback");
    expect(JSON.stringify(row)).not.toContain("device-registration-callback");
  }
});

it("oauth.dcr-rules-from-provider", async () => {
  const allowed =
    "openid profile email offline_access account.client-activity:read workspace.todo:read workspace.todo:write";
  const accepted = await register({ scope: allowed });
  expect(accepted.response.status).toBe(201);
  const registeredScopes = (
    await db.oAuthClient.findUniqueOrThrow({
      where: { clientId: accepted.body.client_id },
    })
  ).scopes;
  expect(registeredScopes).toEqual(accepted.body.scope.split(" "));
  expect(registeredScopes).toEqual(expect.arrayContaining(allowed.split(" ")));
  expect(registeredScopes.some((scope) => scope.startsWith("admin:"))).toBe(
    false,
  );
  for (const scope of [
    "admin:read",
    "admin:write",
    "account.client-activity:write",
    "mcp:tools",
    "unknown:read",
  ]) {
    const count = await db.oAuthClient.count({
      where: { name: { startsWith: marker } },
    });
    const rejected = await register({ scope: `openid ${scope}` });
    expect(rejected.response.status, scope).toBe(400);
    expect(
      await db.oAuthClient.count({ where: { name: { startsWith: marker } } }),
    ).toBe(count);
  }
  const unsupported = await register({ grant_types: ["client_credentials"] });
  expect(unsupported.response.status).toBe(400);
});

it("oauth.public-clients-pkce", async () => {
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
    const response = await getBetterAuthInstance().handler(
      new Request(`${origin}/api/auth/oauth2/authorize?${params}`),
    );
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location")!);
    if (challenge?.code_challenge_method === "S256")
      expect(location.pathname).toBe("/account/sign-in");
    else expect(location.searchParams.get("error")).toBeTruthy();
  }
});
