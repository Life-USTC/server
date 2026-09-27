import { makeSignature } from "better-auth/crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import { tokenPostRoute } from "@/lib/api/routes/auth-token";
import { getBetterAuthInstance } from "@/lib/auth/core";
import {
  getCanonicalOAuthIssuer,
  getOAuthMcpResourceUrl,
} from "@/lib/oauth/resource-urls";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const marker = crypto.randomUUID();
const userId = `token-observation-${marker}`;
const clientId = `token-observation-client-${marker}`;
const origin = "http://localhost:3000";
let cookie: string;
beforeAll(async () => {
  await db.user.create({
    data: { id: userId, email: `${userId}@example.test`, isAdmin: true },
  });
  await db.oAuthClient.create({
    data: {
      clientId,
      name: marker,
      tokenEndpointAuthMethod: "none",
      redirectUris: ["https://client.example/callback"],
      grantTypes: ["authorization_code"],
      responseTypes: ["code"],
      scopes: ["profile"],
    },
  });
  const token = crypto.randomUUID();
  await db.session.create({
    data: {
      userId,
      sessionToken: token,
      expires: new Date(Date.now() + 3600000),
    },
  });
  const context = await getBetterAuthInstance().$context;
  cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${await makeSignature(token, context.secret)}`)}`;
});
afterAll(async () => {
  vi.restoreAllMocks();
  await db.oAuthClient.deleteMany({ where: { clientId } });
  await db.user.deleteMany({ where: { id: userId } });
  await db.$disconnect();
});
function tokenRequest() {
  return new Request(`${origin}/api/auth/oauth2/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin,
      authorization: "Basic private-authorization",
      cookie: "private-cookie",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: "private-code",
      code_verifier: "private-verifier",
      client_id: clientId,
      client_secret: "private-secret",
      refresh_token: "private-refresh",
      resource: getOAuthMcpResourceUrl(),
    }),
  });
}

it("oauth.token-endpoint-observability", async () => {
  const writeDataPoint = vi.fn();
  const connectionString = process.env.AUTH_DATABASE_URL;
  if (!connectionString)
    throw new Error("Expected production authentication database URL");
  const response = await runWithCloudflareRuntimeEnv(
    { ANALYTICS: { writeDataPoint }, HYPERDRIVE_AUTH: { connectionString } },
    () => tokenPostRoute(tokenRequest()),
  );
  expect([400, 401], await response.clone().text()).toContain(response.status);
  const events = writeDataPoint.mock.calls
    .map(([point]) => point)
    .filter((point) => point.blobs[0] === "oauth_event_v3");
  const stages = events.filter(
    (point) => point.blobs[1] === "token.stage.success",
  );
  expect(stages.map((point) => point.blobs[8])).toEqual([
    "validate-active-grant",
    "validate-refresh-resources",
    "prepare-provider-request",
    "secure-provider-response",
    "cleanup-rejected-grant",
    "persist-refresh-resources",
    "bind-access-token-consent",
  ]);
  const provider = events.find(
    (point) =>
      point.blobs[1] === "oauth.token.error_response" &&
      point.blobs[5] === "none",
  );
  const whole = events.find(
    (point) =>
      point.blobs[1].startsWith("oauth.token.") &&
      point.blobs[5] === "authorization_code" &&
      point.blobs[8] === "none",
  );
  expect(provider).toBeDefined();
  expect(whole).toBeDefined();
  for (const point of events)
    expect(point.doubles[0]).toBeGreaterThanOrEqual(0);
  expect(whole.doubles[0]).toBeGreaterThanOrEqual(provider.doubles[0]);
  const serialized = JSON.stringify(events);
  expect(serialized).not.toMatch(/private-|upstream|stack|message/);
  expect(serialized).not.toContain(clientId);
  expect(serialized).not.toContain(getOAuthMcpResourceUrl());
});

it("oauth.provider-resource-policy-cache", async () => {
  const auth = getBetterAuthInstance();
  const context = await auth.$context;
  const resource = getCanonicalOAuthIssuer();
  const headers = new Headers({ cookie, origin });
  const lookup = vi.spyOn(context.adapter, "findOne");
  const creates = vi.spyOn(context.adapter, "create");
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
    return auth.handler(
      new Request(`${origin}/api/auth/oauth2/authorize?${query}`, { headers }),
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
    lookup.mock.calls.filter(([input]) => input.model === "oauthResource"),
  ).toHaveLength(0);
  expect(
    creates.mock.calls.filter(([input]) => input.model === "oauthResource"),
  ).toHaveLength(0);
  await auth.api.adminUpdateOAuthResource({
    headers,
    params: { identifier: resource },
    body: { disabled: true },
  });
  try {
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
  } finally {
    await auth.api.adminUpdateOAuthResource({
      headers,
      params: { identifier: resource },
      body: { disabled: false },
    });
  }
  expect((await authorize()).headers.get("location")).toContain(
    "/oauth/authorize",
  );
  const resources = await db.oauthResource.findMany();
  const before = resources.map((row) => ({
    id: row.id,
    createdAt: row.createdAt,
  }));
  creates.mockClear();
  await tokenPostRoute(tokenRequest());
  await tokenPostRoute(tokenRequest());
  expect(
    creates.mock.calls.filter(([input]) => input.model === "oauthResource"),
  ).toHaveLength(0);
  expect(
    (await db.oauthResource.findMany()).map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
    })),
  ).toEqual(before);
});
