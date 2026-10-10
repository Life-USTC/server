import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import {
  putHomeworkCompletionRoute,
  putHomeworkCompletionsRoute,
} from "@/lib/api/routes/homework-completion";
import {
  deleteHomeworkRoute,
  patchHomeworkRoute,
  postHomeworkRoute,
} from "@/lib/api/routes/homework-mutation-routes";
import {
  mcpDeleteRoute,
  mcpGetRoute,
  mcpOptionsRoute,
  mcpPostRoute,
} from "@/lib/api/routes/mcp";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { createGraphqlYoga } from "@/lib/graphql/server";
import {
  getOAuthGraphqlResourceUrl,
  getOAuthMcpResourceUrl,
  getOAuthRestAudienceUrls,
} from "@/lib/mcp/urls";
import { mcpProtocolTest, ownProtocolRoute } from "./mcp-protocol-fixture";

export const homeworkTransportTest = mcpProtocolTest
  .extend({
    // biome-ignore lint/correctness/noEmptyPattern: Vitest fixture dependency syntax.
    httpHandler: async ({}, use) => {
      await use((request: Request) => {
        const path = new URL(request.url).pathname;
        if (path === "/api/auth/jwks")
          return getBetterAuthInstance().handler(request);
        if (path !== "/api/mcp") return new Response(null, { status: 404 });
        switch (request.method) {
          case "GET":
            return mcpGetRoute(request);
          case "POST":
            return mcpPostRoute(request);
          case "DELETE":
            return mcpDeleteRoute(request);
          case "OPTIONS":
            return mcpOptionsRoute(request);
          default:
            return new Response(null, { status: 405 });
        }
      });
    },
  })
  .extend(
    "state",
    async ({
      http,
      isolatedDatabase: { owner: db },
      protocolRuntime,
      mcpSessions,
    }) => {
      protocolRuntime.setPublicOrigin(http.origin);
      const userId = crypto.randomUUID();
      const clientId = `homework-transport-${crypto.randomUUID()}`;
      const communityWrite = "community.section-homework:write";
      const completionWrite = "workspace.homework:write";
      const scopes = [communityWrite, completionWrite];
      let grantId = "";
      let sectionId = 0;
      const gqlDelete =
        "mutation($id: ID!) { homeworkDelete(id: $id) { success id } }";
      const gqlCreate =
        "mutation($input: CreateHomeworkInput!) { homeworkCreate(input: $input) { id } }";
      const gqlUpdate =
        'mutation($id: ID!) { homeworkUpdate(id: $id, input: {title: "Updated through transport"}) { id } }';
      const gqlComplete =
        "mutation($id: ID!) { homeworkCompletionSet(homeworkId: $id, completed: true) { completed } }";
      const gqlBatch =
        "mutation($id: ID!) { homeworkCompletionsSet(items: [{homeworkId: $id, completed: false}]) { results { success completed } } }";
      async function fixtureHomework(title = `Fixture ${crypto.randomUUID()}`) {
        const row = await db.homework.create({
          data: { sectionId, title, createdById: userId },
        });
        return row.id;
      }
      async function request(
        method: string,
        body: unknown,
        allowedScopes: string[],
        audience = getOAuthRestAudienceUrls()[0],
      ) {
        return protocolRuntime.request(async () => {
          const issuedAt = Math.floor(Date.now() / 1000);
          const token = await signResourceBoundOAuthAccessToken({
            clientId,
            userId,
            grantId,
            scopes: allowedScopes,
            resources: [audience],
            issuedAt,
            expiresAt: issuedAt + 300,
          });
          if (!token) throw new Error("Expected signed resource token");
          return new Request(
            `https://example.test${audience === getOAuthGraphqlResourceUrl() ? "/api/graphql" : "/api/community/section-homeworks"}`,
            {
              method,
              headers: {
                authorization: `Bearer ${token}`,
                ...(body !== undefined
                  ? { "content-type": "application/json" }
                  : {}),
              },
              ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
            },
          );
        });
      }
      async function graphql(
        query: string,
        variables: Record<string, unknown>,
        allowedScopes: string[],
      ) {
        return protocolRuntime.request(async () => {
          return (
            await createGraphqlYoga(false).fetch(
              await request(
                "POST",
                { query, variables },
                allowedScopes,
                getOAuthGraphqlResourceUrl(),
              ),
              { locals: { locale: "zh-cn" } },
            )
          ).json();
        });
      }
      async function httpMcp(scope: string) {
        const signed = await request(
          "POST",
          {},
          [scope],
          getOAuthMcpResourceUrl(),
        );
        const client = mcpSessions.ownClient(
          new Client({
            name: "homework-scope-contract",
            version: "1.0.0",
          }),
        );
        const transport = new StreamableHTTPClientTransport(
          new URL(getOAuthMcpResourceUrl()),
          {
            requestInit: {
              headers: {
                authorization: signed.headers.get("authorization") ?? "",
              },
            },
            fetch: http.fetch,
          },
        );
        await protocolRuntime.request(() => client.connect(transport));
        return client;
      }
      async function httpCall(
        client: Client,
        name: string,
        args: Record<string, unknown>,
      ) {
        const result = await client.callTool({ name, arguments: args });
        if (result.isError) throw new Error(JSON.stringify(result));
        if (result.structuredContent) return result.structuredContent;
        const content = result.content as { type: string; text?: string }[];
        const text = content.find((block) => block.type === "text")?.text;
        if (!text) throw new Error("Expected MCP JSON result");
        return JSON.parse(text);
      }

      const sectionJwId = 1;
      await protocolRuntime.run(async () => {
        await db.$transaction(async (tx) => {
          await tx.user.create({
            data: {
              id: userId,
              name: "Homework scope owner",
              email: `${userId}@test.invalid`,
            },
          });
          await tx.oAuthClient.create({
            data: {
              clientId,
              name: "Homework transport",
              scopes,
              redirectUris: ["https://client.example/callback"],
            },
          });
          grantId = (
            await tx.oAuthConsent.create({
              data: { clientId, userId, scopes },
            })
          ).grantId;
          const course = await tx.course.create({
            data: {
              jwId: 1,
              code: "HWTRANSPORT",
              nameCn: "Homework transport course",
            },
          });
          sectionId = (
            await tx.section.create({
              data: {
                jwId: sectionJwId,
                code: `HWTRANSPORT.${sectionJwId}`,
                courseId: course.id,
              },
            })
          ).id;
        });
      });
      return {
        db,
        routes: {
          postHomeworkRoute: ownProtocolRoute(
            protocolRuntime,
            postHomeworkRoute,
          ),
          patchHomeworkRoute: ownProtocolRoute(
            protocolRuntime,
            patchHomeworkRoute,
          ),
          deleteHomeworkRoute: ownProtocolRoute(
            protocolRuntime,
            deleteHomeworkRoute,
          ),
          putHomeworkCompletionRoute: ownProtocolRoute(
            protocolRuntime,
            putHomeworkCompletionRoute,
          ),
          putHomeworkCompletionsRoute: ownProtocolRoute(
            protocolRuntime,
            putHomeworkCompletionsRoute,
          ),
        },
        userId,
        communityWrite,
        completionWrite,
        sectionId,
        sectionJwId,
        gqlDelete,
        gqlCreate,
        gqlUpdate,
        gqlComplete,
        gqlBatch,
        fixtureHomework,
        request,
        graphql,
        httpMcp,
        httpCall,
      };
    },
  );
