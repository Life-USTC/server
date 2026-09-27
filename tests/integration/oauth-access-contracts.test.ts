import type { RequestEvent } from "@sveltejs/kit";
import { makeSignature } from "better-auth/crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import { getTodosRoute } from "@/lib/api/routes/todos";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { createGraphqlRequestHandler } from "@/lib/graphql/server";
import {
  getCanonicalOAuthIssuer,
  getOAuthGraphqlResourceUrl,
  getOAuthMcpResourceUrl,
} from "@/lib/oauth/resource-urls";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const marker = crypto.randomUUID();
const userId = `oauth-access-${marker}`;
const clientId = `oauth-access-client-${marker}`;
const origin = "http://localhost:3000";
const graphql = createGraphqlRequestHandler(false);
let grantId: string;
let cookie: string;
let todoId: string;
beforeAll(async () => {
  await db.user.create({
    data: { id: userId, email: `${userId}@example.test` },
  });
  const sessionToken = crypto.randomUUID();
  await db.session.create({
    data: { userId, sessionToken, expires: new Date(Date.now() + 3_600_000) },
  });
  const context = await getBetterAuthInstance().$context;
  cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${sessionToken}.${await makeSignature(sessionToken, context.secret)}`)}`;
  const client = await db.oAuthClient.create({
    data: {
      clientId,
      name: "OAuth access contract",
      tokenEndpointAuthMethod: "none",
      scopes: ["profile", "workspace.todo:read", "workspace.calendar:read"],
      consents: {
        create: {
          userId,
          scopes: ["profile", "workspace.todo:read", "workspace.calendar:read"],
          resources: [
            getCanonicalOAuthIssuer(),
            getOAuthGraphqlResourceUrl(),
            getOAuthMcpResourceUrl(),
          ],
        },
      },
    },
    include: { consents: true },
  });
  grantId = client.consents[0].grantId;
  todoId = (await db.todo.create({ data: { userId, title: marker } })).id;
});
afterAll(async () => {
  await db.oAuthClient.deleteMany({ where: { clientId } });
  await db.user.deleteMany({ where: { id: userId } });
  await db.$disconnect();
});
async function signed(resource: string, scopes: string[], dpop = false) {
  const token = await signResourceBoundOAuthAccessToken({
    clientId,
    userId,
    grantId,
    scopes,
    resources: [resource],
    issuedAt: Math.floor(Date.now() / 1000),
    expiresAt: Math.floor(Date.now() / 1000) + 600,
    ...(dpop ? { confirmation: { jkt: "proof-bound-key" } } : {}),
  });
  if (!token) throw new Error("Expected signed resource-bound token");
  return token;
}
async function rest(headers: HeadersInit) {
  const response = await getTodosRoute(
    new Request(`${origin}/api/workspace/todos`, { headers }),
  );
  return { response, body: await response.json() };
}
async function graph(headers: HeadersInit) {
  const response = await graphql({
    request: new Request(getOAuthGraphqlResourceUrl(), {
      method: "POST",
      headers: {
        ...Object.fromEntries(new Headers(headers)),
        "content-type": "application/json",
        origin,
      },
      body: JSON.stringify({
        query: "query { workspace { todos { items { id title } } } }",
      }),
    }),
    locals: { locale: "en-us", requestId: marker },
  } as RequestEvent);
  return { response, body: await response.json() };
}

it("oauth.rest-bearer-scopes", async () => {
  const read = ["workspace.todo:read"];
  for (const [transport, audience] of [
    [rest, getCanonicalOAuthIssuer()],
    [graph, getOAuthGraphqlResourceUrl()],
  ] as const) {
    for (const scenario of [
      { scopes: read, resource: audience, allowed: true },
      { scopes: ["profile"], resource: audience, allowed: false },
      { scopes: [], resource: audience, allowed: false },
      {
        scopes: ["workspace.calendar:read"],
        resource: audience,
        allowed: false,
      },
      { scopes: read, resource: getOAuthMcpResourceUrl(), allowed: false },
      {
        scopes: read,
        resource:
          audience === getCanonicalOAuthIssuer()
            ? getOAuthGraphqlResourceUrl()
            : getCanonicalOAuthIssuer(),
        allowed: false,
      },
      { scopes: read, resource: audience, dpop: true, allowed: false },
    ]) {
      const token = await signed(
        scenario.resource,
        scenario.scopes,
        scenario.dpop,
      );
      const result = await transport({ authorization: `Bearer ${token}` });
      if (scenario.allowed) {
        expect(result.response.status, JSON.stringify(result.body)).toBe(200);
        expect(JSON.stringify(result.body)).toContain(todoId);
        expect(result.body.errors).toBeUndefined();
      } else {
        expect(JSON.stringify(result.body)).not.toContain(todoId);
        if (transport === rest) expect(result.response.status).toBe(401);
        else expect(result.body.errors?.length).toBeGreaterThan(0);
      }
    }
    const session = await transport({ cookie });
    expect(session.response.status, JSON.stringify(session.body)).toBe(200);
    expect(JSON.stringify(session.body)).toContain(todoId);
    expect(session.body.errors).toBeUndefined();
  }
});
