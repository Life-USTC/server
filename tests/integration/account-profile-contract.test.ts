import { createServer, type Server } from "node:http";
import type { RequestEvent } from "@sveltejs/kit";
import { getRequest, setResponse } from "@sveltejs/kit/node";
import { makeSignature } from "better-auth/crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import { getAccountClientActivityRoute } from "@/lib/api/routes/account-client-activity-route";
import { getAccountProfileRoute } from "@/lib/api/routes/account-profile-route";
import { mcpPostRoute } from "@/lib/api/routes/mcp";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { authPrisma } from "@/lib/db/auth-prisma";
import { prisma as runtimePrisma } from "@/lib/db/prisma";
import { createGraphqlRequestHandler } from "@/lib/graphql/server";
import { getOAuthRestAudienceUrls } from "@/lib/oauth/resource-urls";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const marker = crypto.randomUUID();
const userId = `profile-contract-${marker}`;
const otherUserId = `profile-other-${marker}`;
const clientId = `profile-client-${marker}`;
const email = `${userId}@example.test`;
let grantId: string;
let origin: string;
let cookie: string;
let server: Server;
const scopes = [
  "account.profile:read",
  "account.client-activity:read",
  "email",
];

beforeAll(async () => {
  const graphql = createGraphqlRequestHandler(false);
  server = createServer(async (incoming, outgoing) => {
    try {
      const request = await getRequest({ request: incoming, base: origin });
      const path = new URL(request.url).pathname;
      const response =
        path === "/api/auth/jwks"
          ? await getBetterAuthInstance().handler(request)
          : path === "/api/account/profile"
            ? await getAccountProfileRoute(request)
            : path === "/api/account/client-activity"
              ? await getAccountClientActivityRoute(request)
              : path === "/api/mcp"
                ? await mcpPostRoute(request)
                : await graphql({
                    request,
                    locals: {
                      authUser: null,
                      locale: "en-us",
                      requestId: "account-profile-contract",
                    },
                  } as unknown as RequestEvent);
      await setResponse(outgoing, response);
    } catch {
      outgoing.statusCode = 500;
      outgoing.end("Account test server failed");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing server address");
  origin = `http://127.0.0.1:${address.port}`;
  vi.stubEnv("APP_PUBLIC_ORIGIN", origin);
  await db.user.createMany({
    data: [
      { id: userId, email, name: "Profile contract admin", isAdmin: true },
      { id: otherUserId, email: `${otherUserId}@example.test` },
    ],
  });
  await db.oAuthClient.create({
    data: {
      clientId,
      name: "Profile contract",
      scopes,
      redirectUris: ["https://example.test/callback"],
    },
  });
  grantId = (
    await db.oAuthConsent.create({ data: { clientId, userId, scopes } })
  ).grantId;
  const sessionToken = crypto.randomUUID();
  await db.session.create({
    data: { userId, sessionToken, expires: new Date(Date.now() + 3600_000) },
  });
  const context = await getBetterAuthInstance().$context;
  cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${sessionToken}.${await makeSignature(sessionToken, context.secret)}`)}`;
});

afterAll(async () => {
  if (server)
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
  await db.auditLog.deleteMany({
    where: { subjectUserId: { in: [userId, otherUserId] } },
  });
  await db.oAuthClient.deleteMany({ where: { clientId } });
  await db.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
  await Promise.all([
    db.$disconnect(),
    authPrisma.$disconnect(),
    runtimePrisma.$disconnect(),
  ]);
  vi.unstubAllEnvs();
});

async function authorization(
  surface: "rest" | "graphql" | "mcp",
  allowed: string[],
) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const token = await signResourceBoundOAuthAccessToken({
    userId,
    clientId,
    grantId,
    scopes: allowed,
    resources:
      surface === "rest"
        ? getOAuthRestAudienceUrls()
        : [`${origin}/api/${surface}`],
    issuedAt,
    expiresAt: issuedAt + 300,
  });
  if (!token) throw new Error("Token signing failed");
  return { authorization: `Bearer ${token}` };
}

async function graph(
  query: string,
  headers: Record<string, string>,
  variables: Record<string, unknown> = {},
) {
  const response = await fetch(`${origin}/api/graphql`, {
    method: "POST",
    headers: { ...headers, origin, "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  expect(response.status).toBe(200);
  return response.json();
}

async function mcp(
  name: string,
  args: Record<string, unknown>,
  allowed: string[],
) {
  const response = await fetch(`${origin}/api/mcp`, {
    method: "POST",
    headers: {
      ...(await authorization("mcp", allowed)),
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  expect(response.status).toBe(200);
  const text = await response.text();
  const message = response.headers
    .get("content-type")
    ?.includes("text/event-stream")
    ? JSON.parse(
        text
          .split("\n")
          .find((line) => line.startsWith("data: "))
          ?.slice(6) ?? "null",
      )
    : JSON.parse(text);
  expect(message.error).toBeUndefined();
  expect(message.result.isError).not.toBe(true);
  return message.result.structuredContent;
}

it("user.account-profile-oauth-projection", async () => {
  const selection = "{ account { profile { id email name isAdmin } } }";
  const sessionResponse = await fetch(`${origin}/api/account/profile`, {
    headers: { cookie },
  });
  expect(sessionResponse.status).toBe(200);
  expect(await sessionResponse.json()).toMatchObject({
    id: userId,
    email,
    isAdmin: true,
  });
  const sessionGraph = await graph(selection, { cookie });
  expect(sessionGraph.errors).toBeUndefined();
  expect(sessionGraph.data.account.profile).toMatchObject({
    id: userId,
    email,
    isAdmin: true,
  });
  for (const allowEmail of [false, true]) {
    const allowed = ["account.profile:read", ...(allowEmail ? ["email"] : [])];
    const expected = {
      id: userId,
      email: allowEmail ? email : null,
      isAdmin: null,
    };
    const response = await fetch(
      `${origin}/api/account/profile?userId=${otherUserId}`,
      { headers: await authorization("rest", allowed) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject(expected);
    const graphql = await graph(
      selection,
      await authorization("graphql", allowed),
    );
    expect(graphql.errors).toBeUndefined();
    expect(graphql.data.account.profile).toMatchObject(expected);
    expect(await mcp("account_profile_get", {}, allowed)).toMatchObject(
      expected,
    );
  }
});

it("user.oauth-client-activity-isolation", async () => {
  const allowed = ["account.client-activity:read"];
  const events = [];
  for (const [index, identity] of [
    { subjectUserId: userId, oauthClientId: clientId, oauthGrantId: grantId },
    { subjectUserId: userId, oauthClientId: clientId, oauthGrantId: grantId },
    {
      subjectUserId: otherUserId,
      oauthClientId: clientId,
      oauthGrantId: grantId,
    },
    {
      subjectUserId: userId,
      oauthClientId: `other-${clientId}`,
      oauthGrantId: grantId,
    },
    {
      subjectUserId: userId,
      oauthClientId: clientId,
      oauthGrantId: "other-generation",
    },
  ].entries()) {
    events.push(
      await db.auditLog.create({
        data: {
          ...identity,
          id: `activity-${marker}-${String(10 + index).padStart(2, "0")}`,
          action: "comment_create",
          channel: "rest",
          outcome: "success",
          createdAt: new Date(
            1_800_000_000_000 + (index < 2 ? 0 : index * 1000),
          ),
          ipAddress: "203.0.113.49",
          userAgent: "PRIVATE_USER_AGENT",
          sessionId: "PRIVATE_SESSION",
          requestId: "PRIVATE_REQUEST",
          targetId: "PRIVATE_TARGET",
          targetType: "comment",
        },
      }),
    );
  }
  // Equal timestamps must continue by descending unique ID, independently of insertion order.
  const expectedIds = [events[1].id, events[0].id];
  const fields = [
    "action",
    "channel",
    "createdAt",
    "id",
    "outcome",
    "targetType",
  ].sort();
  for (const surface of ["rest", "graphql", "mcp"] as const) {
    const observed: string[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 2; page++) {
      let result: {
        items: Record<string, unknown>[];
        nextCursor: string | null;
      };
      if (surface === "rest") {
        const query = new URLSearchParams({
          limit: "1",
          userId: otherUserId,
          clientId: `other-${clientId}`,
          grantId: "other-generation",
          ...(cursor ? { cursor } : {}),
        });
        const response = await fetch(
          `${origin}/api/account/client-activity?${query}`,
          { headers: await authorization(surface, allowed) },
        );
        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toBe("private, no-store");
        result = await response.json();
      } else if (surface === "graphql") {
        const response = await graph(
          "query($cursor: String) { account { clientActivity(limit: 1, cursor: $cursor) { items { id action outcome channel createdAt targetType } nextCursor } } }",
          await authorization(surface, allowed),
          { cursor },
        );
        expect(response.errors).toBeUndefined();
        result = response.data.account.clientActivity;
      } else
        result = await mcp(
          "account_client_activity_list",
          { limit: 1, ...(cursor ? { cursor } : {}) },
          allowed,
        );
      expect(result.items).toHaveLength(1);
      expect(Object.keys(result.items[0]).sort()).toEqual(fields);
      observed.push(String(result.items[0].id));
      cursor = result.nextCursor;
      if (page === 0) expect(cursor).toBeTruthy();
    }
    expect(observed).toEqual(expectedIds);
    expect(cursor).toBeNull();
  }
  const sessionResponse = await fetch(`${origin}/api/account/client-activity`, {
    headers: { cookie },
  });
  expect(sessionResponse.status).toBe(401);
  await sessionResponse.text();
});
