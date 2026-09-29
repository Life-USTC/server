import type { RequestEvent } from "@sveltejs/kit";
import { makeSignature } from "better-auth/crypto";
import { expect } from "vitest";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import { getAccountClientActivityRoute } from "@/lib/api/routes/account-client-activity-route";
import { getAccountProfileRoute } from "@/lib/api/routes/account-profile-route";
import { mcpPostRoute } from "@/lib/api/routes/mcp";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { createGraphqlRequestHandler } from "@/lib/graphql/server";
import { getOAuthRestAudienceUrls } from "@/lib/oauth/resource-urls";
import { nodeHttpTest } from "./node-http-contract-fixture";

// Real provider caches are process-owned; each consumer has one case per file.
export const accountProfileTest = nodeHttpTest
  .extend({
    // biome-ignore lint/correctness/noEmptyPattern: Vitest fixture dependency syntax.
    httpHandler: async ({}, use) => {
      const graphql = createGraphqlRequestHandler(false);
      await use(async (request: Request) => {
        const path = new URL(request.url).pathname;
        return path === "/api/auth/jwks"
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
      });
    },
  })
  .extend(
    "account",
    async ({ http, isolatedDatabase: { owner: db }, protocolRuntime }) => {
      const { origin, fetch } = http;
      // The real MCP verifier fetches JWKS from this case's native listener.
      // Set its origin before Better Auth or a runtime request initializes.
      protocolRuntime.setPublicOrigin(origin);
      const marker = crypto.randomUUID();
      const userId = `profile-contract-${marker}`;
      const otherUserId = `profile-other-${marker}`;
      const clientId = `profile-client-${marker}`;
      const email = `${userId}@example.test`;
      const scopes = [
        "account.profile:read",
        "account.client-activity:read",
        "email",
      ];
      const { grantId, cookie } = await protocolRuntime.run(async () => {
        const sessionToken = crypto.randomUUID();
        const grantId = await db.$transaction(async (tx) => {
          await tx.user.createMany({
            data: [
              {
                id: userId,
                email,
                name: "Profile contract admin",
                isAdmin: true,
              },
              { id: otherUserId, email: `${otherUserId}@example.test` },
            ],
          });
          await tx.oAuthClient.create({
            data: {
              clientId,
              name: "Profile contract",
              scopes,
              redirectUris: ["https://example.test/callback"],
            },
          });
          const grant = await tx.oAuthConsent.create({
            data: { clientId, userId, scopes },
          });
          await tx.session.create({
            data: {
              userId,
              sessionToken,
              expires: new Date(Date.now() + 3600_000),
            },
          });
          return grant.grantId;
        });
        const context = await getBetterAuthInstance().$context;
        const cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${sessionToken}.${await makeSignature(sessionToken, context.secret)}`)}`;
        return { grantId, cookie };
      });

      async function authorization(
        surface: "rest" | "graphql" | "mcp",
        allowed: string[],
      ) {
        return protocolRuntime.request(async () => {
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
        });
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

      return {
        db,
        marker,
        userId,
        otherUserId,
        clientId,
        email,
        grantId,
        origin,
        cookie,
        fetch,
        authorization,
        graph,
        mcp,
      };
    },
  );
