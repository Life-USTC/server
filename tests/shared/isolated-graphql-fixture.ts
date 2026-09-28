import type { RequestEvent } from "@sveltejs/kit";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import { setCloudflareCatalogInvalidator } from "@/lib/adapters/cloudflare-runtime";
import { createGraphqlRequestHandler } from "@/lib/graphql/server";
import { getOAuthGraphqlResourceUrl } from "@/lib/oauth/resource-urls";
import { isolatedDatabaseTest } from "./isolated-database";
import { createNodeRuntime } from "./node-runtime";

export type GraphqlPayload = {
  data?: Record<string, unknown> | null;
  errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
};

type GraphqlRuntime = {
  run<T>(work: () => T | Promise<T>): Promise<T>;
  execute(
    body: unknown,
    token?: string,
    extraHeaders?: Record<string, string>,
  ): Promise<{ response: Response; payload: GraphqlPayload }>;
  signToken(
    userId: string,
    clientId: string,
    scopes: string[],
  ): Promise<string>;
};

/** Direct GraphQL/MCP contracts retain the real restricted app/auth roles. */
export const isolatedGraphqlTest = isolatedDatabaseTest.extend<{
  graphqlLocale: "en-us" | "zh-cn";
  graphqlRuntime: GraphqlRuntime;
}>({
  graphqlLocale: "en-us",
  graphqlRuntime: async ({ isolatedDatabase, graphqlLocale }, use) => {
    const { connections, owner: db } = isolatedDatabase;
    const handler = createGraphqlRequestHandler(false);
    const origin = "https://life.example";
    const runtime = createNodeRuntime({
      APP_PUBLIC_ORIGIN: origin,
      APP_CANONICAL_ORIGIN: origin,
      HYPERDRIVE: { connectionString: connections.app },
      HYPERDRIVE_AUTH: { connectionString: connections.auth },
      HYPERDRIVE_MAINTENANCE: { connectionString: connections.maintenance },
      // Queue delivery and rate limiting have separate Worker contracts;
      // these direct transport cases exercise authentication and persistence.
      USER_WRITE_RATE_LIMITER: { limit: async () => ({ success: true }) },
      USER_BATCH_WRITE_RATE_LIMITER: { limit: async () => ({ success: true }) },
      CALENDAR_EXPORT_REBUILD: { send: async () => {} },
    });
    function run<T>(work: () => T | Promise<T>): Promise<T> {
      return runtime.run(() => {
        // This in-process transport has no Worker HTML cache. Cache
        // invalidation is covered by the Worker contracts.
        setCloudflareCatalogInvalidator(async () => {});
        return work();
      });
    }

    async function execute(
      body: unknown,
      token?: string,
      extraHeaders: Record<string, string> = {},
    ) {
      const response = await run(() =>
        handler({
          request: new Request(`${origin}/api/graphql`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...(token ? { authorization: `Bearer ${token}` } : {}),
              ...extraHeaders,
            },
            body: JSON.stringify(body),
          }),
          locals: {
            authUser: null,
            locale: graphqlLocale,
            requestId: "graphql-isolated-integration",
          },
        } as unknown as RequestEvent),
      );
      return { response, payload: (await response.json()) as GraphqlPayload };
    }

    async function signToken(
      userId: string,
      clientId: string,
      scopes: string[],
    ) {
      const consent = await db.oAuthConsent.findFirstOrThrow({
        where: { clientId, scopes: { hasEvery: scopes }, userId },
        select: { grantId: true },
      });
      const issuedAt = Math.floor(Date.now() / 1000);
      const token = await run(() =>
        signResourceBoundOAuthAccessToken({
          clientId,
          grantId: consent.grantId,
          expiresAt: issuedAt + 300,
          issuedAt,
          resources: [getOAuthGraphqlResourceUrl()],
          scopes,
          userId,
        }),
      );
      if (!token) throw new Error("Expected a signed GraphQL access token");
      return token;
    }

    try {
      // Register ownership before dependent fixtures allocate actors or start IO.
      await use({ run, execute, signToken });
    } finally {
      await runtime.close();
    }
  },
});
