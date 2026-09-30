import type { RequestEvent } from "@sveltejs/kit";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import { createGraphqlRequestHandler } from "@/lib/graphql/server";
import { getOAuthGraphqlResourceUrl } from "@/lib/oauth/resource-urls";
import { nodeProtocolTest } from "./node-protocol-fixture";
import type { NodeProtocolRuntime } from "./node-protocol-runtime";

export type GraphqlPayload = {
  data?: Record<string, unknown> | null;
  errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
};

type GraphqlRuntime = Pick<NodeProtocolRuntime, "run" | "request" | "drain"> & {
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
export const isolatedGraphqlTest = nodeProtocolTest
  .extend({
    protocolBindings: {
      APP_PUBLIC_ORIGIN: "https://life.example",
      APP_CANONICAL_ORIGIN: "https://life.example",
    },
  })
  .extend<{
    graphqlLocale: "en-us" | "zh-cn";
    graphqlRuntime: GraphqlRuntime;
  }>({
    graphqlLocale: "en-us",
    graphqlRuntime: async (
      { isolatedDatabase: { owner: db }, graphqlLocale, protocolRuntime },
      use,
    ) => {
      const handler = createGraphqlRequestHandler(false);
      const origin = "https://life.example";

      async function execute(
        body: unknown,
        token?: string,
        extraHeaders: Record<string, string> = {},
      ) {
        return protocolRuntime.request(async () => {
          const response = await handler({
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
          } as unknown as RequestEvent);
          return { response, payload: (await response.json()) as GraphqlPayload };
        });
      }

      async function signToken(
        userId: string,
        clientId: string,
        scopes: string[],
      ) {
        return protocolRuntime.request(async () => {
          const consent = await db.oAuthConsent.findFirstOrThrow({
            where: { clientId, scopes: { hasEvery: scopes }, userId },
            select: { grantId: true },
          });
          const issuedAt = Math.floor(Date.now() / 1000);
          const token = await signResourceBoundOAuthAccessToken({
            clientId,
            grantId: consent.grantId,
            expiresAt: issuedAt + 300,
            issuedAt,
            resources: [getOAuthGraphqlResourceUrl()],
            scopes,
            userId,
          });
          if (!token) throw new Error("Expected a signed GraphQL access token");
          return token;
        });
      }

      // The protocol fixture owns both lifetimes before dependent setup begins;
      // its cleanup reports original failures after the outer database closes.
      await use({
        run: protocolRuntime.run,
        request: protocolRuntime.request,
        drain: protocolRuntime.drain,
        execute,
        signToken,
      });
    },
  });
