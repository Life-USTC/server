import { readFileSync } from "node:fs";
import { describe, expect, vi } from "vitest";
import { setCloudflareRequestContext } from "@/lib/adapters/cloudflare-runtime";
import {
  GRAPHQL_OPERATIONS_RESOURCE_URI,
  GRAPHQL_SCHEMA_RESOURCE_URI,
} from "@/lib/graphql/constants";
import { publicGraphqlOperationsManifest } from "@/lib/graphql/operations";
import { GRAPHQL_OPERATION_PROMPT_NAME } from "@/lib/graphql/prompts";
import { restReadScope, restWriteScope } from "@/lib/oauth/constants";
import { catalogMcpTest as toolTest } from "./mcp/_harness/catalog-fixture";
import type { PrivateMcpActor } from "./mcp/_harness/isolated-context";

// Each correlation assertion owns its log buffer, even in concurrent cases.
const observedLogs = await vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  return new AsyncLocalStorage<
    Parameters<typeof import("@/lib/log/app-log-emitter").emitLog>[]
  >();
});
vi.mock("@/lib/log/app-log-emitter", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/log/app-log-emitter")>();
  return {
    ...original,
    emitLog: (...args: Parameters<typeof original.emitLog>) => {
      observedLogs.getStore()?.push(args);
      return original.emitLog(...args);
    },
  };
});
describe("GraphQL MCP operations", () => {
  const marker = `[integration-test] graphql-mcp-${Date.now()}`;

  async function callExpectedGraphqlError<T>(
    isolated: PrivateMcpActor,
    args: Record<string, unknown>,
  ): Promise<T> {
    const result = await isolated.client.callToolResult(
      "graphql_operation_run",
      args,
    );
    expect(result.isError).toBe(true);
    return result.structuredContent as T;
  }

  toolTest(
    "interface-hierarchy.transport-specific-exceptions-11",
    { tags: ["@GraphQL/MCP"] },
    async ({ mcpWorkflow, mcpActor: isolated, expect }) =>
      mcpWorkflow.run(async () => {
        const resources = await isolated.client.listResources();

        expect(resources.resources).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ uri: GRAPHQL_SCHEMA_RESOURCE_URI }),
            expect.objectContaining({ uri: GRAPHQL_OPERATIONS_RESOURCE_URI }),
          ]),
        );

        const schema = await isolated.client.readResource(
          GRAPHQL_SCHEMA_RESOURCE_URI,
        );
        const operations = await isolated.client.readResource(
          GRAPHQL_OPERATIONS_RESOURCE_URI,
        );

        expect(schema.contents[0]).toMatchObject({
          uri: GRAPHQL_SCHEMA_RESOURCE_URI,
          mimeType: "text/plain",
        });
        expect(schema.contents[0]).toHaveProperty(
          "text",
          readFileSync("docs/graphql/schema.graphql", "utf8"),
        );
        const operationContent = operations.contents[0];
        if (!operationContent || !("text" in operationContent)) {
          throw new Error("GraphQL operations manifest must be text");
        }
        const manifest = JSON.parse(operationContent.text) as Record<
          string,
          unknown
        >;
        expect(manifest).toMatchObject({
          schemaVersion: 1,
          operations: expect.arrayContaining([
            expect.objectContaining({
              id: "workspace.todo.list.v1",
              scopes: ["workspace.todo:read"],
              readOnly: true,
            }),
            expect.objectContaining({
              id: "workspace.todo.delete.v1",
              scopes: ["workspace.todo:write"],
              destructive: true,
              requiresConfirmation: true,
            }),
          ]),
        });
        expect(manifest).toEqual(publicGraphqlOperationsManifest);
        expect(JSON.stringify([schema, operations])).not.toContain(
          isolated.userId,
        );
        expect(JSON.stringify(manifest)).not.toContain('"document"');
      }),
  );

  toolTest(
    "graphql.graphql-operation-prompt",
    { tags: ["@GraphQL/MCP"] },
    async ({ mcpWorkflow, mcpActor: isolated, expect }) =>
      mcpWorkflow.run(async () => {
        expect(isolated.client.getInstructions()).toContain(
          GRAPHQL_OPERATION_PROMPT_NAME,
        );

        const prompts = await isolated.client.listPrompts();
        expect(prompts.prompts).toContainEqual(
          expect.objectContaining({ name: GRAPHQL_OPERATION_PROMPT_NAME }),
        );

        const prompt = await isolated.client.getPrompt(
          GRAPHQL_OPERATION_PROMPT_NAME,
          {
            goal: "List my incomplete todos",
            operationType: "query",
          },
        );
        expect(prompt.description).toContain("safe, bounded");
        const guidance = prompt.messages.find(
          (message) => message.content.type === "text",
        )?.content;
        expect(guidance).toMatchObject({
          type: "text",
          text: expect.stringContaining("Goal: List my incomplete todos"),
        });
        if (guidance?.type !== "text") {
          throw new Error("Expected GraphQL planning guidance text");
        }
        expect(guidance.text).toContain("graphql_operation_run");
        expect(guidance.text).not.toContain("run_graphql_operation");
        expect(guidance.text).toContain("confirmed=true");
        expect(guidance.text).toContain("insufficient_scope");
        expect(guidance.text).toContain("exactly once");
        expect(guidance.text).toContain("explicit bounded pagination");
        expect(guidance.text).toContain("request only the listed scopes");
        expect(guidance.text).toContain("REQUEST_TIMEOUT or REQUEST_CANCELLED");
        expect(guidance.text).toContain(
          "inspect current state instead of blindly retrying",
        );
        for (const message of prompt.messages) {
          if (message.content.type !== "resource") continue;
          const resource = message.content.resource;
          if (!("text" in resource))
            throw new Error("Expected embedded text resource");
          if (resource.uri === GRAPHQL_SCHEMA_RESOURCE_URI) {
            const { graphqlSchemaSdl } = await import(
              "@/lib/graphql/resources"
            );
            expect(resource.text).toBe(graphqlSchemaSdl);
          } else if (resource.uri === GRAPHQL_OPERATIONS_RESOURCE_URI) {
            const { graphqlOperationsManifest } = await import(
              "@/lib/graphql/resources"
            );
            expect(resource.text).toBe(graphqlOperationsManifest);
            expect(resource.text).not.toContain('"document"');
          }
        }
        expect(prompt.messages).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              content: expect.objectContaining({
                type: "resource",
                resource: expect.objectContaining({
                  uri: GRAPHQL_SCHEMA_RESOURCE_URI,
                  text: expect.stringContaining("type Query"),
                }),
              }),
            }),
            expect.objectContaining({
              content: expect.objectContaining({
                type: "resource",
                resource: expect.objectContaining({
                  uri: GRAPHQL_OPERATIONS_RESOURCE_URI,
                  text: expect.stringContaining('"workspace.todo.list.v1"'),
                }),
              }),
            }),
          ]),
        );
      }),
  );

  toolTest(
    "exposes arbitrary documents and compatible registered operations",
    { tags: ["@GraphQL/MCP"] },
    async ({ mcpWorkflow, mcpActor: isolated, expect }) =>
      mcpWorkflow.run(async () => {
        const { tools } = await isolated.client.listTools();
        const runner = tools.find(
          (tool) => tool.name === "graphql_operation_run",
        );

        expect(tools.map((tool) => tool.name)).not.toContain("execute_graphql");
        expect(runner).toBeDefined();
        expect(runner?.description).toContain(GRAPHQL_OPERATION_PROMPT_NAME);
        expect(
          Object.keys(runner?.inputSchema.properties ?? {}).sort(),
        ).toEqual([
          "confirmed",
          "document",
          "locale",
          "operationId",
          "operationName",
          "variables",
        ]);
        expect(runner?.inputSchema.properties).toHaveProperty("document");
        expect(runner?.inputSchema.properties?.document).toMatchObject({
          description: expect.stringContaining(GRAPHQL_SCHEMA_RESOURCE_URI),
        });
        expect(runner?.outputSchema).toMatchObject({
          type: "object",
          required: expect.arrayContaining(["success"]),
          additionalProperties: false,
        });
        expect(runner?._meta).toMatchObject({
          securitySchemes: [{ type: "oauth2", scopes: [] }],
          "life-ustc/graphqlOperationsManifest": 1,
        });
        expect(runner?.annotations).toMatchObject({
          readOnlyHint: false,
          destructiveHint: true,
          openWorldHint: true,
        });
      }),
  );

  toolTest(
    "correlates nested GraphQL observations with the HTTP request id",
    { tags: ["@GraphQL/MCP"] },
    async ({ mcpWorkflow, mcpActor: isolated, expect, mcpRuntime }) =>
      mcpWorkflow.run(async () => {
        const logs: Parameters<
          typeof import("@/lib/log/app-log-emitter").emitLog
        >[] = [];
        const result = await observedLogs.run(logs, () =>
          mcpRuntime.run(() => {
            setCloudflareRequestContext({
              method: "POST",
              requestId: "mcp-http-request-51",
              route: "/api/mcp",
            });
            return isolated.client.call("graphql_operation_run", {
              operationId: "workspace.todo.list.v1",
              variables: {},
            });
          }),
        );
        expect(result).toMatchObject({ success: true });

        const operationLog = logs.find(
          ([prefix, _level, value]) =>
            prefix === "[app]" &&
            typeof value === "object" &&
            value !== null &&
            "event" in value &&
            value.event === "graphql.operation" &&
            "requestId" in value &&
            value.requestId === "mcp-http-request-51",
        );
        expect(operationLog?.[2]).toEqual(
          expect.objectContaining({
            requestId: "mcp-http-request-51",
            route: "/api/mcp",
          }),
        );
      }),
  );

  toolTest(
    "runs arbitrary documents with fragments, aliases, and variables",
    { tags: ["@GraphQL/MCP"] },
    async ({ mcpWorkflow, mcpActor: isolated, expect }) =>
      mcpWorkflow.run(async () => {
        const result = await isolated.client.call<{
          success: boolean;
          operationId: string;
          operationName: string;
          data: {
            account: { todos: { pageInfo: { pageSize: number } } };
          };
        }>("graphql_operation_run", {
          document: /* GraphQL */ `
        query ArbitraryTodos($page: PageInput) {
          account: workspace {
            ...WorkspaceTodos
          }
        }

        fragment WorkspaceTodos on Workspace {
          todos(page: $page) {
            pageInfo { pageSize }
            items { id title }
          }
        }
      `,
          operationName: "ArbitraryTodos",
          variables: { page: { pageSize: 2 } },
          locale: "zh-cn",
        });

        expect(result).toMatchObject({
          success: true,
          operationId: "document",
          operationName: "ArbitraryTodos",
          data: { account: { todos: { pageInfo: { pageSize: 2 } } } },
        });
      }),
  );

  toolTest(
    "graphql.mcp-mutation-confirmation",
    { tags: ["@GraphQL/MCP"] },
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      expect,
      isolatedDatabase: { owner: db },
      mcpSessions,
    }) =>
      mcpWorkflow.run(async () => {
        const readOnlySession = mcpSessions.own(isolated.userId, [
          restReadScope("workspace.todo"),
        ]);
        await readOnlySession.initialize();
        const readOnly = readOnlySession.client;
        const other = await db.user.create({
          data: { email: `${crypto.randomUUID()}@confirmed-authority.test` },
        });
        const foreignActorSession = mcpSessions.own(other.id, [
          restWriteScope("workspace.todo"),
        ]);
        await foreignActorSession.initialize();
        const foreignActor = foreignActorSession.client;
        for (const mode of ["document", "registered"] as const) {
          const title = `${marker}-confirmation-${mode}`;
          const input = {
            ...(mode === "document"
              ? {
                  document:
                    "mutation CreateTodo($input: CreateTodoInput!) { todoCreate(input: $input) { id } }",
                  operationName: "CreateTodo",
                }
              : { operationId: "workspace.todo.create.v1" }),
            variables: { input: { title } },
            locale: "zh-cn",
          };
          for (const confirmed of [undefined, false]) {
            const result = await callExpectedGraphqlError(isolated, {
              ...input,
              confirmed,
            });
            expect(result).toMatchObject({
              success: false,
              error: "CONFIRMATION_REQUIRED",
            });
            expect(
              await db.todo.count({
                where: { userId: isolated.userId, title },
              }),
            ).toBe(0);
          }
          const insufficient = await readOnly.callToolResult(
            "graphql_operation_run",
            { ...input, confirmed: true },
          );
          expect(insufficient).toMatchObject({
            isError: true,
            structuredContent: { success: false, error: "FORBIDDEN" },
          });
          expect(
            await db.todo.count({
              where: { userId: isolated.userId, title },
            }),
          ).toBe(0);
          const result = await isolated.client.call("graphql_operation_run", {
            ...input,
            confirmed: true,
          });
          expect(result).toMatchObject({ success: true });
          expect(
            await db.todo.count({
              where: { userId: isolated.userId, title },
            }),
          ).toBe(1);
          const owned = await db.todo.findFirstOrThrow({
            where: { userId: isolated.userId, title },
          });
          const denied = await foreignActor.callToolResult(
            "graphql_operation_run",
            {
              ...(mode === "document"
                ? {
                    document:
                      "mutation($id:ID!) { todoDelete(id:$id) { id success } }",
                  }
                : { operationId: "workspace.todo.delete.v1" }),
              variables: { id: owned.id },
              confirmed: true,
            },
          );
          expect(denied).toMatchObject({
            isError: true,
            structuredContent: {
              success: false,
              errors: [{ extensions: { code: "NOT_FOUND" } }],
            },
          });
          expect(await db.todo.findUnique({ where: { id: owned.id } })).toEqual(
            owned,
          );
        }
      }),
  );

  toolTest(
    "graphql.graphql-operation-runner",
    { tags: ["@GraphQL/MCP"] },
    async ({ mcpWorkflow, mcpActor: isolated, expect, mcpCatalog: _catalog }) =>
      mcpWorkflow.run(async () => {
        for (const input of [
          {},
          {
            operationId: "catalog.semester.current.get.v1",
            document: "query Current { catalog { currentSemester { jwId } } }",
          },
        ]) {
          expect(
            await callExpectedGraphqlError(isolated, {
              ...input,
              locale: "zh-cn",
            }),
          ).toMatchObject({ success: false, error: "BAD_USER_INPUT" });
        }
        for (const input of [
          { operationId: "catalog.semester.current.get.v1" },
          {
            document: "query Current { catalog { currentSemester { jwId } } }",
          },
        ]) {
          const result = await isolated.client.call("graphql_operation_run", {
            ...input,
            locale: "zh-cn",
          });
          expect(result).toMatchObject({
            success: true,
            data: {
              catalog: { currentSemester: { jwId: expect.any(Number) } },
            },
          });
        }
      }),
  );

  toolTest(
    "graphql.mcp-validation-parity",
    { tags: ["@GraphQL/MCP"] },
    async ({ mcpWorkflow, mcpActor: isolated, expect, mcpRuntime }) =>
      mcpWorkflow.run(async () => {
        const { createGraphqlRequestHandler } = await import(
          "@/lib/graphql/server"
        );
        const handler = createGraphqlRequestHandler(true);
        const documents = [
          "query Broken {",
          "{ __schema { queryType { name } } }",
          `{ ${Array.from({ length: 11 }, (_, i) => `f${i}: catalog { currentSemester { jwId } }`).join(" ")} }`,
          `{ catalog { courses { ${Array.from({ length: 16 }, (_, i) => `a${i}: items { jwId }`).join(" ")} } } }`,
          `{ catalog { courses { items { ${Array.from({ length: 11 }, (_, i) => `f${i}: code @skip(if: false)`).join(" ")} } } } }`,
          `{ catalog { courses { items { ${"code ".repeat(990)} } } } }`,
          `{ catalog { courses(page: { pageSize: 100 }) { items { ${"code ".repeat(60)} } } } }`,
          "{ catalog { courses(page: { pageSize: 101 }) { pageInfo { total } } } }",
        ];
        for (const document of documents) {
          const mcp = await isolated.client.callToolResult(
            "graphql_operation_run",
            { document, locale: "zh-cn" },
          );
          expect(mcp.isError, document.slice(0, 80)).toBe(true);
          const request = new Request("http://localhost:3000/api/graphql", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ query: document }),
          });
          const response = await mcpRuntime.run(() =>
            handler({
              request,
              locals: { locale: "zh-cn", requestId: "mcp-validation-parity" },
            } as Parameters<typeof handler>[0]),
          );
          const http = (await response.json()) as { errors?: unknown[] };
          expect(http.errors?.length, document.slice(0, 80)).toBeGreaterThan(0);
        }
        for (const variables of [
          { unexpected: true },
          { filter: { search: "x".repeat(65537) } },
          { page: { pageSize: 101 } },
        ]) {
          const result = await isolated.client.callToolResult(
            "graphql_operation_run",
            {
              operationId: "catalog.course.search.v1",
              variables,
              locale: "zh-cn",
            },
          );
          expect(result.isError).toBe(true);
        }
      }),
  );

  toolTest(
    "rejects ambiguous inputs, introspection, and over-wide documents",
    { tags: ["@GraphQL/MCP"] },
    async ({ mcpWorkflow, mcpActor: isolated, expect }) =>
      mcpWorkflow.run(async () => {
        const ambiguous = await callExpectedGraphqlError<{
          error: string;
          success: boolean;
        }>(isolated, {
          operationId: "workspace.todo.list.v1",
          document: "query Account { account { profile { id } } }",
          locale: "zh-cn",
        });
        expect(ambiguous).toMatchObject({
          success: false,
          error: "BAD_USER_INPUT",
        });

        const introspection = await callExpectedGraphqlError<{
          success: boolean;
          errors: Array<{ message: string }>;
        }>(isolated, {
          document: "query Inspect { __schema { queryType { name } } }",
          operationName: "Inspect",
          locale: "zh-cn",
        });
        expect(introspection.success).toBe(false);
        expect(introspection.errors[0]?.message).toMatch(/introspection/i);

        const overWide = await callExpectedGraphqlError<{
          success: boolean;
          errors: Array<{ message: string }>;
        }>(isolated, {
          document: `query TooWide { ${Array.from(
            { length: 11 },
            (_, index) => `field${index}: catalog { currentSemester { jwId } }`,
          ).join(" ")} }`,
          operationName: "TooWide",
          locale: "zh-cn",
        });
        expect(overWide).toMatchObject({ success: false });
        expect(overWide.errors[0]?.message).toBe(
          "Query has too many top-level fields.",
        );
      }),
  );

  toolTest(
    "runs approved Viewer reads and confirmed mutations",
    { tags: ["@GraphQL/MCP"] },
    async ({ mcpWorkflow, mcpActor: isolated, expect }) =>
      mcpWorkflow.run(async () => {
        const todos = await isolated.client.call<{
          success: boolean;
          data: {
            workspace: {
              todos: {
                items: unknown[];
                pageInfo: { pageSize: number };
              };
            };
          };
        }>("graphql_operation_run", {
          operationId: "workspace.todo.list.v1",
          variables: { page: { pageSize: 2 } },
          locale: "zh-cn",
        });
        expect(todos).toMatchObject({
          success: true,
          data: {
            workspace: {
              todos: {
                pageInfo: { pageSize: 2 },
              },
            },
          },
        });

        const missingConfirmation = await callExpectedGraphqlError<{
          success: boolean;
          error: string;
        }>(isolated, {
          operationId: "workspace.todo.create.v1",
          variables: { input: { title: marker } },
          locale: "zh-cn",
        });
        expect(missingConfirmation).toMatchObject({
          success: false,
          error: "CONFIRMATION_REQUIRED",
        });

        const created = await isolated.client.call<{
          success: boolean;
          data: { todoCreate: { id: string } };
        }>("graphql_operation_run", {
          operationId: "workspace.todo.create.v1",
          variables: {
            input: { title: marker, priority: "HIGH" },
          },
          confirmed: true,
          locale: "zh-cn",
        });
        expect(created.success).toBe(true);
        const createdTodoId = created.data.todoCreate.id;

        const completed = await isolated.client.call<{
          success: boolean;
          data: {
            todoCompletionsSet: {
              results: Array<{
                success: boolean;
                todoId: string;
                completed: boolean;
              }>;
            };
          };
        }>("graphql_operation_run", {
          operationId: "workspace.todo.completions.set.v1",
          variables: {
            items: [{ todoId: createdTodoId, completed: true }],
          },
          confirmed: true,
          locale: "zh-cn",
        });
        expect(completed).toMatchObject({
          success: true,
          data: {
            todoCompletionsSet: {
              results: [
                {
                  success: true,
                  todoId: createdTodoId,
                  completed: true,
                },
              ],
            },
          },
        });

        const deleted = await isolated.client.call<{
          success: boolean;
          data: { todoDelete: { id: string; success: boolean } };
        }>("graphql_operation_run", {
          operationId: "workspace.todo.delete.v1",
          variables: { id: createdTodoId },
          confirmed: true,
          locale: "zh-cn",
        });
        expect(deleted).toMatchObject({
          success: true,
          data: {
            todoDelete: {
              id: createdTodoId,
              success: true,
            },
          },
        });
      }),
  );

  toolTest(
    "rejects variables outside the selected registered operation",
    { tags: ["@GraphQL/MCP"] },
    async ({ mcpWorkflow, mcpActor: isolated, expect }) =>
      mcpWorkflow.run(async () => {
        const result = await callExpectedGraphqlError<{
          success: boolean;
          error: string;
          message: string;
        }>(isolated, {
          operationId: "workspace.todo.list.v1",
          variables: {
            document: "query Arbitrary { workspace { profile { email } } }",
          },
          locale: "zh-cn",
        });

        expect(result).toMatchObject({
          success: false,
          error: "BAD_USER_INPUT",
          message: "Unknown variable: document.",
        });
      }),
  );

  toolTest(
    "returns an exact insufficient-scope challenge for reauthorization",
    { tags: ["@GraphQL/MCP"] },
    async ({ mcpWorkflow, mcpActor: isolated, expect, mcpSessions }) =>
      mcpWorkflow.run(async () => {
        const limitedMcpSession = mcpSessions.own(isolated.userId, [
          restReadScope("workspace.homework"),
        ]);
        await limitedMcpSession.initialize();
        const limitedMcp = limitedMcpSession.client;
        const result = await limitedMcp.callToolResult(
          "graphql_operation_run",
          {
            operationId: "workspace.todo.list.v1",
            variables: {},
            locale: "zh-cn",
          },
        );

        expect(result).toMatchObject({
          isError: true,
          structuredContent: {
            success: false,
            error: "FORBIDDEN",
            requiredScopes: [restReadScope("workspace.todo")],
          },
        });
        expect(result._meta?.["mcp/www_authenticate"]).toEqual([
          expect.stringContaining('error="insufficient_scope"'),
        ]);
        expect(result._meta?.["mcp/www_authenticate"]).toEqual([
          expect.stringContaining(`scope="${restReadScope("workspace.todo")}"`),
        ]);
      }),
  );

  toolTest(
    "enforces resolver scopes for arbitrary documents",
    { tags: ["@GraphQL/MCP"] },
    async ({ mcpWorkflow, mcpActor: isolated, expect, mcpSessions }) =>
      mcpWorkflow.run(async () => {
        const limitedMcpSession = mcpSessions.own(isolated.userId, [
          restReadScope("workspace.homework"),
        ]);
        await limitedMcpSession.initialize();
        const limitedMcp = limitedMcpSession.client;
        const result = await limitedMcp.callToolResult(
          "graphql_operation_run",
          {
            document:
              "query ScopedTodos { workspace { todos { items { id } } } }",
            operationName: "ScopedTodos",
            variables: {},
            locale: "zh-cn",
          },
        );

        expect(result).toMatchObject({
          isError: true,
          structuredContent: {
            success: false,
            errors: [
              expect.objectContaining({
                extensions: expect.objectContaining({
                  code: "FORBIDDEN",
                  requiredScopes: [restReadScope("workspace.todo")],
                }),
              }),
            ],
          },
        });
        expect(result._meta?.["mcp/www_authenticate"]).toEqual([
          expect.stringContaining(`scope="${restReadScope("workspace.todo")}"`),
        ]);
      }),
  );

  toolTest(
    "preflights every mutation scope before any selected field executes",
    { tags: ["@GraphQL/MCP"] },
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      expect,
      isolatedDatabase: { owner: db },
      mcpSessions,
    }) =>
      mcpWorkflow.run(async () => {
        const todoOnlyMcpSession = mcpSessions.own(isolated.userId, [
          restWriteScope("workspace.todo"),
        ]);
        await todoOnlyMcpSession.initialize();
        const todoOnlyMcp = todoOnlyMcpSession.client;
        const title = `${marker}-mixed-scope`;
        const result = await todoOnlyMcp.callToolResult(
          "graphql_operation_run",
          {
            document: /* GraphQL */ `
          mutation MixedScopes($input: CreateTodoInput!) {
            todoCreate(input: $input) { id }
            busPreferencesSet(input: { showDepartedTrips: false }) {
              showDepartedTrips
            }
          }
        `,
            operationName: "MixedScopes",
            variables: { input: { title } },
            confirmed: true,
            locale: "zh-cn",
          },
        );

        expect(result).toMatchObject({
          isError: true,
          structuredContent: {
            success: false,
            error: "FORBIDDEN",
            requiredScopes: [restWriteScope("workspace.bus-preferences")],
          },
        });
        expect(await db.todo.count({ where: { title } })).toBe(0);
      }),
  );

  toolTest(
    "preflights only mutation fields included by GraphQL directives",
    { tags: ["@GraphQL/MCP"] },
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      expect,
      isolatedDatabase: { owner: db },
      mcpSessions,
    }) =>
      mcpWorkflow.run(async () => {
        const todoOnlyMcpSession = mcpSessions.own(isolated.userId, [
          restWriteScope("workspace.todo"),
        ]);
        await todoOnlyMcpSession.initialize();
        const todoOnlyMcp = todoOnlyMcpSession.client;
        const document = /* GraphQL */ `
      mutation ConditionalScopes(
        $input: CreateTodoInput!
        $skipBus: Boolean!
        $includeBus: Boolean!
      ) {
        created: todoCreate(input: $input) { id }
        ...BusMutation @skip(if: $skipBus) @include(if: $includeBus)
      }

      fragment BusMutation on Mutation {
        preferences: busPreferencesSet(
          input: { showDepartedTrips: false }
        ) { showDepartedTrips }
      }
    `;
        for (const [suffix, skipBus, includeBus] of [
          ["skip", true, true],
          ["exclude", false, false],
        ] as const) {
          const title = `${marker}-${suffix}-bus`;
          const result = await todoOnlyMcp.call<{
            success: boolean;
            data: { created: { id: string } };
          }>("graphql_operation_run", {
            document,
            operationName: "ConditionalScopes",
            variables: {
              input: { title },
              skipBus,
              includeBus,
            },
            confirmed: true,
            locale: "zh-cn",
          });
          expect(result.success, JSON.stringify(result)).toBe(true);
          expect(
            await db.todo.findUnique({
              where: { id: result.data.created.id },
              select: { title: true, userId: true },
            }),
          ).toEqual({ title, userId: isolated.userId });
        }

        const blockedTitle = `${marker}-included-bus`;
        const blocked = await todoOnlyMcp.callToolResult(
          "graphql_operation_run",
          {
            document,
            operationName: "ConditionalScopes",
            variables: {
              input: { title: blockedTitle },
              skipBus: false,
              includeBus: true,
            },
            confirmed: true,
            locale: "zh-cn",
          },
        );
        expect(blocked).toMatchObject({
          isError: true,
          structuredContent: {
            success: false,
            error: "FORBIDDEN",
            requiredScopes: [restWriteScope("workspace.bus-preferences")],
          },
        });
        expect(await db.todo.count({ where: { title: blockedTitle } })).toBe(0);
      }),
  );
});
