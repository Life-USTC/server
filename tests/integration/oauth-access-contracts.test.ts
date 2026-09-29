import type { RequestEvent } from "@sveltejs/kit";
import { makeSignature } from "better-auth/crypto";
import { expect } from "vitest";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import { getTodosRoute } from "@/lib/api/routes/todos";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { createGraphqlRequestHandler } from "@/lib/graphql/server";
import {
  getCanonicalOAuthIssuer,
  getOAuthGraphqlResourceUrl,
  getOAuthMcpResourceUrl,
} from "@/lib/oauth/resource-urls";
import { isolatedNodeTest } from "../shared/isolated-node-fixture";

const origin = "http://localhost:3000";
const test = isolatedNodeTest.extend(
  "state",
  async ({ isolatedDatabase, nodeRuntime }) =>
    nodeRuntime.run(async () => {
      const db = isolatedDatabase.owner;
      const marker = crypto.randomUUID();
      const userId = `oauth-access-${marker}`;
      const clientId = `oauth-access-client-${marker}`;
      const graphql = createGraphqlRequestHandler(false);
      const sessionToken = crypto.randomUUID();
      const { grantId, todoId } = await db.$transaction(async (db) => {
        await db.user.create({
          data: { id: userId, email: `${userId}@example.test` },
        });
        await db.session.create({
          data: {
            userId,
            sessionToken,
            expires: new Date(Date.now() + 3_600_000),
          },
        });
        const client = await db.oAuthClient.create({
          data: {
            clientId,
            name: "OAuth access contract",
            tokenEndpointAuthMethod: "none",
            scopes: [
              "profile",
              "workspace.todo:read",
              "workspace.calendar:read",
            ],
            consents: {
              create: {
                userId,
                scopes: [
                  "profile",
                  "workspace.todo:read",
                  "workspace.calendar:read",
                ],
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
        const grantId = client.consents[0].grantId;
        const todoId = (
          await db.todo.create({ data: { userId, title: marker } })
        ).id;
        return { grantId, todoId };
      });
      const context = await getBetterAuthInstance().$context;
      const cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${sessionToken}.${await makeSignature(sessionToken, context.secret)}`)}`;
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
        const response = await nodeRuntime.run(() =>
          getTodosRoute(
            new Request(`${origin}/api/workspace/todos`, { headers }),
          ),
        );
        return { response, body: await response.json() };
      }
      async function graph(headers: HeadersInit) {
        const response = await nodeRuntime.run(() =>
          graphql({
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
          } as RequestEvent),
        );
        return { response, body: await response.json() };
      }

      return { signed, rest, graph, todoId, cookie, userId, clientId };
    }),
);

for (const [name, kind] of [
  ["oauth.rest-bearer-scopes", "rest"],
  ["oauth.graphql-bearer-scopes", "graphql"],
] as const) {
  test(name, async ({ state, isolatedDatabase, nodeRuntime }) =>
    nodeRuntime.run(async () => {
      const { signed, rest, graph, todoId, cookie, userId, clientId } = state;
      const read = ["workspace.todo:read"];
      const transport = kind === "rest" ? rest : graph;
      const audience =
        kind === "rest"
          ? getCanonicalOAuthIssuer()
          : getOAuthGraphqlResourceUrl();
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
      expect(
        await isolatedDatabase.owner.todo.findMany({
          select: { id: true, userId: true },
        }),
      ).toEqual([{ id: todoId, userId }]);
      expect(
        await isolatedDatabase.owner.oAuthConsent.findMany({
          select: { clientId: true, userId: true },
        }),
      ).toEqual([{ clientId, userId }]);
      expect(await isolatedDatabase.owner.jwks.count()).toBe(1);
      // Direct REST handlers omit the HTTP request-finish hook; Yoga owns its
      // usage lifecycle here. Worker contracts cover REST HTTP accounting.
      expect(
        await isolatedDatabase.owner.oAuthGrantUsageDaily.findMany({
          select: {
            userId: true,
            clientId: true,
            channel: true,
            feature: true,
            readCount: true,
            writeCount: true,
            errorCount: true,
          },
        }),
      ).toEqual(
        kind === "rest"
          ? []
          : [
              {
                userId,
                clientId,
                channel: "graphql",
                feature: "workspace.todo",
                readCount: 1,
                writeCount: 0,
                errorCount: 0,
              },
            ],
      );
    }),
  );
}
