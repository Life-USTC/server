import type { RequestEvent } from "@sveltejs/kit";
import { expect } from "vitest";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import { resolveActiveOAuthRefreshGrant } from "@/features/oauth/server/user-authorizations.server";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import { authGetRoute, authPostRoute } from "@/lib/api/routes/auth";
import { mcpPostRoute } from "@/lib/api/routes/mcp";
import { getTodosRoute } from "@/lib/api/routes/todos";
import { createGraphqlRequestHandler } from "@/lib/graphql/server";
import { hasActiveOAuthUserGrant } from "@/lib/oauth/active-user-grant";
import {
  getCanonicalOAuthIssuer,
  getOAuthGraphqlResourceUrl,
  getOAuthMcpResourceUrl,
} from "@/lib/oauth/resource-urls";
import { hashOAuthClientSecretForDbStorage } from "@/lib/oauth/utils";
import { oauthJwksTest } from "../shared/oauth-jwks-server";

for (const method of ["REST", "GraphQL", "MCP", "OAuth", "Service"] as const) {
  oauthJwksTest(
    `oauth.authorization-management.active-user-grant-enforcement ${method}`,
    { timeout: 30000, tags: [`@OAuth/${method}`] },
    async ({
      isolatedDatabase: { owner: db, connections },
      oauthRuntime,
      jwks: { origin },
    }) => {
      await oauthRuntime.run(async () => {
        const marker = crypto.randomUUID();
        const userId = `active-grant-${marker}`;
        const clientId = `active-grant-client-${marker}`;
        const secret = `active-grant-secret-${marker}`;
        const scopes = [
          "openid",
          "profile",
          "offline_access",
          "workspace.todo:read",
        ];
        const graph = createGraphqlRequestHandler(false);
        const { grantId, todoId } = await db.$transaction(async (tx) => {
          await tx.user.create({
            data: { id: userId, email: `${userId}@example.test` },
          });
          await tx.oAuthClient.create({
            data: {
              clientId,
              name: marker,
              tokenEndpointAuthMethod: "client_secret_post",
              clientSecret: await hashOAuthClientSecretForDbStorage(secret),
              scopes,
              grantTypes: ["authorization_code", "refresh_token"],
            },
          });
          const consent = await tx.oAuthConsent.create({
            data: {
              userId,
              clientId,
              scopes,
              resources: [
                getCanonicalOAuthIssuer(),
                getOAuthGraphqlResourceUrl(),
                getOAuthMcpResourceUrl(),
              ],
            },
          });
          const grantId = consent.grantId;
          const todoId = (
            await tx.todo.create({ data: { userId, title: marker } })
          ).id;
          return { grantId, todoId };
        });

        async function tokens(generation?: string, tokenScopes = scopes) {
          const jwt: string[] = [];
          for (const resource of [
            getCanonicalOAuthIssuer(),
            getOAuthGraphqlResourceUrl(),
            getOAuthMcpResourceUrl(),
          ]) {
            const signed = await signResourceBoundOAuthAccessToken({
              userId,
              clientId,
              grantId: generation,
              scopes: tokenScopes,
              resources: [resource],
              issuedAt: Math.floor(Date.now() / 1000),
              expiresAt: Math.floor(Date.now() / 1000) + 600,
            });
            if (!signed) throw new Error("Expected signed JWT");
            jwt.push(signed);
          }
          const opaque = crypto.randomUUID();
          const refresh = crypto.randomUUID();
          await db.oAuthAccessToken.create({
            data: {
              userId,
              clientId,
              token: await hashOAuthClientSecretForDbStorage(opaque),
              grantId: generation,
              referenceId: generation,
              scopes: tokenScopes,
              expiresAt: new Date(Date.now() + 600000),
            },
          });
          await db.oAuthRefreshToken.create({
            data: {
              userId,
              clientId,
              token: await hashOAuthClientSecretForDbStorage(refresh),
              grantId: generation,
              referenceId: generation,
              scopes: tokenScopes,
              resources: [getCanonicalOAuthIssuer()],
              expiresAt: new Date(Date.now() + 600000),
            },
          });
          return { jwt, opaque, refresh };
        }

        async function introspect(token: string, hint: string) {
          const response = await oauthRuntime.request(() =>
            authPostRoute(
              new Request(`${getCanonicalOAuthIssuer()}/oauth2/introspect`, {
                method: "POST",
                headers: {
                  "content-type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                  token,
                  token_type_hint: hint,
                  client_id: clientId,
                  client_secret: secret,
                }),
              }),
            ),
          );
          const body = await response.json();
          expect(response.status, JSON.stringify(body)).toBe(200);
          return body.active;
        }

        async function accesses(
          set: Awaited<ReturnType<typeof tokens>>,
          allowed: boolean,
        ) {
          if (method === "REST") {
            const rest = await oauthRuntime.request(() =>
              getTodosRoute(
                new Request(`${origin}/api/workspace/todos`, {
                  headers: { authorization: `Bearer ${set.jwt[0]}` },
                }),
              ),
            );
            const restBody = await rest.text();
            expect(rest.status, restBody).toBe(allowed ? 200 : 401);
            expect(restBody.includes(todoId)).toBe(allowed);
          }
          if (method === "GraphQL") {
            const gql = await oauthRuntime.request(() =>
              graph({
                request: new Request(getOAuthGraphqlResourceUrl(), {
                  method: "POST",
                  headers: {
                    authorization: `Bearer ${set.jwt[1]}`,
                    "content-type": "application/json",
                    origin,
                  },
                  body: JSON.stringify({
                    query: "query { workspace { todos { items { id } } } }",
                  }),
                }),
                locals: { locale: "en-us", requestId: marker },
              } as RequestEvent),
            );
            const gqlBody = await gql.json();
            expect(
              Boolean(gqlBody.errors?.length),
              JSON.stringify(gqlBody),
            ).toBe(!allowed);
            expect(JSON.stringify(gqlBody).includes(todoId)).toBe(allowed);
          }
          if (method === "MCP") {
            const mcp = await oauthRuntime.request(() =>
              mcpPostRoute(
                new Request(getOAuthMcpResourceUrl(), {
                  method: "POST",
                  headers: {
                    authorization: `Bearer ${set.jwt[2]}`,
                    "content-type": "application/json",
                    accept: "application/json, text/event-stream",
                  },
                  body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 1,
                    method: "tools/call",
                    params: { name: "workspace_todo_list", arguments: {} },
                  }),
                }),
              ),
            );
            const mcpBody = await mcp.text();
            expect(mcp.status, mcpBody).toBe(allowed ? 200 : 401);
            expect(mcpBody.includes(todoId), mcpBody).toBe(allowed);
          }
          if (method === "OAuth") {
            const userinfo = await oauthRuntime.request(() =>
              authGetRoute(
                new Request(`${getCanonicalOAuthIssuer()}/oauth2/userinfo`, {
                  headers: { authorization: `Bearer ${set.jwt[0]}` },
                }),
              ),
            );
            expect(userinfo.status, await userinfo.clone().text()).toBe(
              allowed ? 200 : 401,
            );
            for (const [token, hint] of [
              [set.jwt[0], "access_token"],
              [set.opaque, "access_token"],
              [set.refresh, "refresh_token"],
            ])
              expect(await introspect(token, hint)).toBe(allowed);
          }
          if (method === "Service")
            expect(
              Boolean(await resolveActiveOAuthRefreshGrant(set.refresh)),
            ).toBe(allowed);
        }

        const old = await tokens(grantId);
        await accesses(old, true);
        await db.oAuthConsent.deleteMany({ where: { userId, clientId } });
        await accesses(old, false);
        const replacement = await db.oAuthConsent.create({
          data: { userId, clientId, scopes },
        });
        await accesses(old, false);
        const current = await tokens(replacement.grantId);
        await accesses(current, true);
        await db.oAuthConsent.update({
          where: { id: replacement.id },
          data: { scopes: ["profile"] },
        });
        await accesses(current, false);
        await db.oAuthConsent.update({
          where: { id: replacement.id },
          data: { scopes },
        });
        await accesses(await tokens(), false);
        const authUrl = connections.auth;
        if (!authUrl)
          throw new Error("Expected production authentication role URL");
        const unavailable = new URL(authUrl);
        unavailable.username = `missing-role-${marker}`;
        unavailable.password = "invalid-contract-password";
        await runWithCloudflareRuntimeEnv(
          {
            APP_PUBLIC_ORIGIN: origin,
            APP_CANONICAL_ORIGIN: origin,
            HYPERDRIVE: { connectionString: connections.app },
            HYPERDRIVE_AUTH: { connectionString: unavailable.toString() },
          },
          async () => {
            if (method === "Service") {
              await expect(
                hasActiveOAuthUserGrant({
                  userId,
                  clientId,
                  grantId: replacement.grantId,
                  requireGrantBinding: true,
                  scopes,
                }),
              ).rejects.toThrow();
            }
            if (method === "REST") {
              const rejected = await getTodosRoute(
                new Request(`${origin}/api/workspace/todos`, {
                  headers: { authorization: `Bearer ${current.jwt[0]}` },
                }),
              );
              expect(rejected.status).toBe(401);
              expect(await rejected.text()).not.toContain(todoId);
            }
          },
        );
        await accesses(current, true);
        await db.oAuthClient.update({
          where: { clientId },
          data: { skipConsent: true },
        });
        if (method === "Service") {
          expect(
            await hasActiveOAuthUserGrant({
              userId,
              clientId,
              requireGrantBinding: true,
            }),
          ).toBe(true);
          expect(
            await hasActiveOAuthUserGrant({
              userId: "missing-user",
              clientId,
              requireGrantBinding: true,
            }),
          ).toBe(false);
        }
      });
    },
  );
}
