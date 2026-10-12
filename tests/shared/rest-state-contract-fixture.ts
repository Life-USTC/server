import type { RequestEvent, RequestHandler } from "@sveltejs/kit";
import { createGraphqlRequestHandler } from "@/lib/graphql/server";
import { createCatalogContractFixture } from "./catalog-contract-fixture";
import { nodeHttpTest } from "./node-http-contract-fixture";

const graphqlHandler = createGraphqlRequestHandler(false);
const modules = import.meta.glob<Record<string, RequestHandler>>(
  "../../src/routes/api/**/+server.ts",
);
const routes = Object.entries(modules)
  .map(([file, load]) => {
    const path = file
      .replace("../../src/routes", "")
      .replace("/+server.ts", "");
    const names: string[] = [];
    const pattern = new RegExp(
      `^${path.replace(/\[([^\]]+)\]/g, (_, name: string) => {
        names.push(name.replace(/^\.\.\./, ""));
        return name.startsWith("...") ? "(.+)" : "([^/]+)";
      })}$`,
    );
    return { path, names, pattern, load };
  })
  .sort(
    (a, b) =>
      Number(a.path.includes("[...")) - Number(b.path.includes("[...")) ||
      a.names.length - b.names.length ||
      b.path.length - a.path.length,
  );

type RateLimit = {
  mode: "limited" | "unavailable" | undefined;
  budgetCalls: string[];
};
export const restStateTest = nodeHttpTest
  .extend<{
    rateLimit: RateLimit;
    protocolBindings: Record<string, unknown>;
    httpHandler: (request: Request) => Response | Promise<Response>;
  }>({
    // biome-ignore lint/correctness/noEmptyPattern: Vitest fixture dependency syntax.
    rateLimit: async ({}, use) => {
      await use({ mode: undefined, budgetCalls: [] });
    },
    protocolBindings: async ({ rateLimit }, use) => {
      await use({
        // Provider limiter contracts require its normal mode even when another
        // test runner enables debug authentication for browser fixtures.
        E2E_DEBUG_AUTH: "0",
        USER_WRITE_RATE_LIMITER: {
          limit: async ({ key }: { key: string }) => {
            if (!rateLimit.mode) return { success: true };
            rateLimit.budgetCalls.push(key);
            if (rateLimit.mode === "unavailable")
              throw new Error("Fixture limiter unavailable");
            return { success: false };
          },
        },
      });
    },
    // biome-ignore lint/correctness/noEmptyPattern: Vitest fixture dependency syntax.
    httpHandler: async ({}, use) => {
      await use(async (request) => {
        const url = new URL(request.url);
        const route = routes.find(({ pattern }) => pattern.test(url.pathname));
        if (!route) throw new Error("Unknown fixture route");
        const match = route.pattern.exec(url.pathname);
        if (!match) throw new Error("Route did not match");
        const params = Object.fromEntries(
          route.names.map((name, i) => [name, match[i + 1]]),
        );
        const handler =
          url.pathname === "/api/graphql"
            ? graphqlHandler
            : (await route.load())[request.method];
        return handler({
          request,
          url,
          params,
          locals: { locale: "en-us" },
        } as unknown as RequestEvent);
      });
    },
  })
  .extend(
    "rest",
    async ({ http, isolatedDatabase: { owner: db }, protocolRuntime }) => {
      await protocolRuntime.run(() => createCatalogContractFixture(db));
      return { db, origin: http.origin, fetch: http.fetch };
    },
  );
