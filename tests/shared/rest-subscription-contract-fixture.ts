import type { RequestEvent } from "@sveltejs/kit";
import { makeSignature } from "better-auth/crypto";
import { getCourseDetailRoute } from "@/lib/api/routes/academic-course-routes";
import { getSectionDetailRoute } from "@/lib/api/routes/academic-section-routes";
import { getCurrentCalendarSubscriptionRoute } from "@/lib/api/routes/calendar-subscriptions";
import { patchSubscriptionKindRoute } from "@/lib/api/routes/subscription-kind-route";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { createGraphqlRequestHandler } from "@/lib/graphql/server";

import { ownMcpHarness } from "../integration/mcp/_harness/client";
import { createCatalogContractFixture } from "./catalog-contract-fixture";
import { nodeHttpTest } from "./node-http-contract-fixture";

const graphqlHandler = createGraphqlRequestHandler(false);
export const restSubscriptionTest = nodeHttpTest
  .extend({
    // biome-ignore lint/correctness/noEmptyPattern: Vitest fixture dependency syntax.
    httpHandler: async ({}, use) => {
      await use(async (request: Request) =>
        new URL(request.url).pathname === "/api/graphql"
          ? await graphqlHandler({
              request,
              locals: { locale: "en-us" },
            } as RequestEvent)
          : new URL(request.url).pathname.startsWith("/api/catalog/courses/")
            ? await getCourseDetailRoute(request, {
                jwId: new URL(request.url).pathname.split("/").at(-1)!,
              })
            : new URL(request.url).pathname.startsWith("/api/catalog/sections/")
              ? await getSectionDetailRoute(request, {
                  jwId: new URL(request.url).pathname.split("/").at(-1)!,
                })
              : request.method === "PATCH"
                ? await patchSubscriptionKindRoute(
                    request,
                    new URL(request.url).pathname.split("/").at(-1),
                  )
                : await getCurrentCalendarSubscriptionRoute(request),
      );
    },
  })
  .extend(
    "subscription",
    async (
      {
        http,
        isolatedDatabase: { owner: db },
        protocolRuntime,
        onTestFinished,
      },
      { onCleanup },
    ) => {
      const users: string[] = [];
      const clients: ReturnType<typeof ownMcpHarness>[] = [];
      onCleanup(async () => {
        // Preserve the workflow barrier; the enclosing runtime owns its error.
        await Promise.allSettled([protocolRuntime.drain()]);
        const results = await Promise.allSettled(
          clients.map((client) => client.client.close()),
        );
        const failures = results.flatMap((result) =>
          result.status === "rejected" ? [result.reason] : [],
        );
        if (failures.length) {
          const error = new AggregateError(
            failures,
            "Subscription MCP cleanup failed",
          );
          onTestFinished(() => {
            throw error;
          });
        }
      });
      await protocolRuntime.run(() => createCatalogContractFixture(db));
      async function createMcpHarness(userId: string) {
        const owned = ownMcpHarness(userId, undefined, {
          run: protocolRuntime.request,
        });
        clients.push(owned);
        await owned.initialize();
        return owned.client;
      }
      async function user() {
        return protocolRuntime.request(async () => {
          const row = await db.user.create({
            data: {
              email: `${crypto.randomUUID()}@subscription-contract.test`,
            },
          });
          users.push(row.id);
          const token = crypto.randomUUID();
          await db.session.create({
            data: {
              userId: row.id,
              sessionToken: token,
              expires: new Date(Date.now() + 3600_000),
            },
          });
          const context = await getBetterAuthInstance().$context;
          return {
            id: row.id,
            cookie: `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${await makeSignature(token, context.secret)}`)}`,
          };
        });
      }

      return {
        db,
        users,
        user,
        createMcpHarness,
        origin: http.origin,
        fetch: http.fetch,
      };
    },
  );
