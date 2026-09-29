import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import {
  putHomeworkCompletionRoute,
  putHomeworkCompletionsRoute,
} from "@/lib/api/routes/homework-completion";
import { getHomeworkDetailRoute } from "@/lib/api/routes/homework-detail-read-route";
import { getHomeworksRoute } from "@/lib/api/routes/homework-list-read-route";
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
import { handleMcpRequest } from "@/lib/api/routes/mcp-request-handler";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { createGraphqlYoga } from "@/lib/graphql/server";
import {
  getOAuthGraphqlResourceUrl,
  getOAuthMcpResourceUrl,
  getOAuthRestAudienceUrls,
} from "@/lib/mcp/urls";
import type { McpHarness } from "../integration/mcp/_harness/client";
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
      const users = Array.from({ length: 3 }, () => crypto.randomUUID());
      const clientId = `homework-transport-${crypto.randomUUID()}`;
      const communityWrite = "community.section-homework:write";
      const completionWrite = "workspace.homework:write";
      const scopes = [communityWrite, completionWrite];
      const grants: string[] = [];
      const clients: McpHarness[] = [];
      let sectionId = 0;
      const title = `Public homework ${crypto.randomUUID()}`;
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
          data: { sectionId, title, createdById: users[0] },
        });
        return row.id;
      }
      async function request(
        index: number,
        method: string,
        body?: unknown,
        allowedScopes = scopes,
        audience = getOAuthRestAudienceUrls()[0],
      ) {
        return protocolRuntime.request(async () => {
          const issuedAt = Math.floor(Date.now() / 1000);
          const token = await signResourceBoundOAuthAccessToken({
            clientId,
            userId: users[index],
            grantId: grants[index],
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
        index: number,
        query: string,
        variables: Record<string, unknown>,
        allowedScopes = scopes,
      ) {
        return protocolRuntime.request(async () => {
          return (
            await createGraphqlYoga(false).fetch(
              await request(
                index,
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
          0,
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
      const initialized = await protocolRuntime.run(async () => {
        const publicId = await db.$transaction(async (tx) => {
          await tx.user.createMany({
            data: users.map((id, index) => ({
              id,
              name: `Homework transport ${index}`,
              email: `${id}@test.invalid`,
              isAdmin: index === 2,
            })),
          });
          await tx.oAuthClient.create({
            data: {
              clientId,
              name: "Homework transport",
              scopes,
              redirectUris: ["https://client.example/callback"],
            },
          });
          for (const userId of users) {
            grants.push(
              (
                await tx.oAuthConsent.create({
                  data: { clientId, userId, scopes },
                })
              ).grantId,
            );
          }
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
          const homework = await tx.homework.create({
            data: { sectionId, title, createdById: users[0] },
          });
          await tx.description.create({
            data: {
              homeworkId: homework.id,
              content: "Public assignment details",
            },
          });
          await tx.homeworkCompletion.create({
            data: { userId: users[0], homeworkId: homework.id },
          });
          return homework.id;
        });
        for (const userId of users)
          clients.push(await mcpSessions.createMcpHarness(userId, scopes));
        const onlyCommunity = await httpMcp(communityWrite);
        const onlyCompletion = await httpMcp(completionWrite);
        return { publicId, onlyCommunity, onlyCompletion };
      });
      return {
        db,
        routes: {
          getHomeworksRoute: ownProtocolRoute(
            protocolRuntime,
            getHomeworksRoute,
          ),
          getHomeworkDetailRoute: ownProtocolRoute(
            protocolRuntime,
            getHomeworkDetailRoute,
          ),
          handleMcpRequest: ownProtocolRoute(protocolRuntime, handleMcpRequest),
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
        users,
        clientId,
        communityWrite,
        completionWrite,
        scopes,
        grants,
        clients,
        ...initialized,
        sectionId,
        sectionJwId,
        title,
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
