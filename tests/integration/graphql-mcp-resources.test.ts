import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, withUserDbContext } from "@/lib/db/prisma";
import {
  GRAPHQL_OPERATIONS_RESOURCE_URI,
  GRAPHQL_SCHEMA_RESOURCE_URI,
} from "@/lib/graphql/constants";
import { GRAPHQL_OPERATION_PROMPT_NAME } from "@/lib/graphql/prompts";
import { restReadScope, restWriteScope } from "@/lib/oauth/constants";
import { DEV_SEED } from "../fixtures/dev-seed";
import { createMcpHarness, type McpHarness } from "./utils/mcp-harness";

describe.sequential("GraphQL MCP operations", () => {
  let mcp: McpHarness;
  let createdTodoId = "";
  let userId = "";
  const marker = `[integration-test] graphql-mcp-${Date.now()}`;

  beforeAll(async () => {
    const user = await prisma.user.findFirst({
      where: { username: DEV_SEED.debugUsername },
      select: { id: true },
    });
    if (!user) throw new Error("Expected the seeded development user");
    userId = user.id;
    mcp = await createMcpHarness(userId);
  });

  afterAll(async () => {
    if (createdTodoId) {
      await prisma.todo.deleteMany({ where: { id: createdTodoId } });
    }
    try {
      await mcp?.close();
    } finally {
      await prisma.$disconnect();
    }
  });

  it("lists the canonical SDL and a document-free operation manifest", async () => {
    const resources = await mcp.listResources();

    expect(resources.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ uri: GRAPHQL_SCHEMA_RESOURCE_URI }),
        expect.objectContaining({ uri: GRAPHQL_OPERATIONS_RESOURCE_URI }),
      ]),
    );

    const schema = await mcp.readResource(GRAPHQL_SCHEMA_RESOURCE_URI);
    const operations = await mcp.readResource(GRAPHQL_OPERATIONS_RESOURCE_URI);

    expect(schema.contents[0]).toMatchObject({
      uri: GRAPHQL_SCHEMA_RESOURCE_URI,
      mimeType: "text/plain",
    });
    expect(schema.contents[0]).toHaveProperty(
      "text",
      expect.stringContaining("type Query"),
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
          id: "viewer.todos.v1",
          scopes: ["todo:read"],
          readOnly: true,
        }),
        expect.objectContaining({
          id: "todo.delete.v1",
          scopes: ["todo:write"],
          destructive: true,
          requiresConfirmation: true,
        }),
      ]),
    });
    expect((manifest.operations as unknown[]).length).toBe(44);
    expect(JSON.stringify(manifest)).not.toContain('"document"');
  });

  it("injects schema-aware GraphQL planning guidance through MCP", async () => {
    expect(mcp.getInstructions()).toContain(GRAPHQL_OPERATION_PROMPT_NAME);

    const prompts = await mcp.listPrompts();
    expect(prompts.prompts).toContainEqual(
      expect.objectContaining({ name: GRAPHQL_OPERATION_PROMPT_NAME }),
    );

    const prompt = await mcp.getPrompt(GRAPHQL_OPERATION_PROMPT_NAME, {
      goal: "List my incomplete todos",
      operationType: "query",
    });
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
    expect(guidance.text).toContain("confirmed=true");
    expect(guidance.text).toContain("insufficient_scope");
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
              text: expect.stringContaining('"viewer.todos.v1"'),
            }),
          }),
        }),
      ]),
    );
  });

  it("exposes arbitrary documents and compatible registered operations", async () => {
    const { tools } = await mcp.listTools();
    const runner = tools.find((tool) => tool.name === "run_graphql_operation");

    expect(tools.map((tool) => tool.name)).not.toContain("execute_graphql");
    expect(runner).toBeDefined();
    expect(runner?.description).toContain(GRAPHQL_OPERATION_PROMPT_NAME);
    expect(Object.keys(runner?.inputSchema.properties ?? {}).sort()).toEqual([
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
  });

  it("runs arbitrary documents with fragments, aliases, and variables", async () => {
    const result = await mcp.call<{
      success: boolean;
      operationId: string;
      operationName: string;
      data: {
        account: { todos: { pageInfo: { pageSize: number } } };
      };
    }>("run_graphql_operation", {
      document: /* GraphQL */ `
        query ArbitraryTodos($page: PageInput) {
          account: viewer {
            ...ViewerTodos
          }
        }

        fragment ViewerTodos on Viewer {
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
  });

  it("requires confirmation for every arbitrary mutation", async () => {
    const result = await mcp.call<{
      success: boolean;
      error: string;
    }>("run_graphql_operation", {
      document: /* GraphQL */ `
        mutation CreateTodo($input: CreateTodoInput!) {
          createTodo(input: $input) { id }
        }
      `,
      operationName: "CreateTodo",
      variables: { input: { title: marker } },
      locale: "zh-cn",
    });

    expect(result).toMatchObject({
      success: false,
      error: "CONFIRMATION_REQUIRED",
    });
  });

  it("rejects ambiguous inputs, introspection, and over-wide documents", async () => {
    const ambiguous = await mcp.call<{ error: string; success: boolean }>(
      "run_graphql_operation",
      {
        operationId: "viewer.todos.v1",
        document: "query Viewer { viewer { profile { id } } }",
        locale: "zh-cn",
      },
    );
    expect(ambiguous).toMatchObject({
      success: false,
      error: "BAD_USER_INPUT",
    });

    const introspection = await mcp.call<{
      success: boolean;
      errors: Array<{ message: string }>;
    }>("run_graphql_operation", {
      document: "query Inspect { __schema { queryType { name } } }",
      operationName: "Inspect",
      locale: "zh-cn",
    });
    expect(introspection.success).toBe(false);
    expect(introspection.errors[0]?.message).toMatch(/introspection/i);

    const overWide = await mcp.call<{
      success: boolean;
      errors: Array<{ message: string }>;
    }>("run_graphql_operation", {
      document: `query TooWide { ${Array.from(
        { length: 11 },
        (_, index) => `field${index}: currentSemester { jwId }`,
      ).join(" ")} }`,
      operationName: "TooWide",
      locale: "zh-cn",
    });
    expect(overWide).toMatchObject({ success: false });
    expect(overWide.errors[0]?.message).toBe(
      "Query has too many top-level fields.",
    );
  });

  it("runs approved Viewer reads and confirmed mutations", async () => {
    const todos = await mcp.call<{
      success: boolean;
      data: {
        viewer: {
          todos: {
            items: unknown[];
            pageInfo: { pageSize: number };
          };
        };
      };
    }>("run_graphql_operation", {
      operationId: "viewer.todos.v1",
      variables: { page: { pageSize: 2 } },
      locale: "zh-cn",
    });
    expect(todos).toMatchObject({
      success: true,
      data: {
        viewer: {
          todos: {
            pageInfo: { pageSize: 2 },
          },
        },
      },
    });

    const missingConfirmation = await mcp.call<{
      success: boolean;
      error: string;
    }>("run_graphql_operation", {
      operationId: "todo.create.v1",
      variables: { input: { title: marker } },
      locale: "zh-cn",
    });
    expect(missingConfirmation).toMatchObject({
      success: false,
      error: "CONFIRMATION_REQUIRED",
    });

    const created = await mcp.call<{
      success: boolean;
      data: { createTodo: { id: string } };
    }>("run_graphql_operation", {
      operationId: "todo.create.v1",
      variables: {
        input: { title: marker, priority: "HIGH" },
      },
      confirmed: true,
      locale: "zh-cn",
    });
    expect(created.success).toBe(true);
    createdTodoId = created.data.createTodo.id;

    const completed = await mcp.call<{
      success: boolean;
      data: {
        setTodoCompletions: {
          results: Array<{
            success: boolean;
            todoId: string;
            completed: boolean;
          }>;
        };
      };
    }>("run_graphql_operation", {
      operationId: "todo.set_completions_batch.v1",
      variables: {
        items: [{ todoId: createdTodoId, completed: true }],
      },
      confirmed: true,
      locale: "zh-cn",
    });
    expect(completed).toMatchObject({
      success: true,
      data: {
        setTodoCompletions: {
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

    const deleted = await mcp.call<{
      success: boolean;
      data: { deleteTodo: { id: string; success: boolean } };
    }>("run_graphql_operation", {
      operationId: "todo.delete.v1",
      variables: { id: createdTodoId },
      confirmed: true,
      locale: "zh-cn",
    });
    expect(deleted).toMatchObject({
      success: true,
      data: {
        deleteTodo: {
          id: createdTodoId,
          success: true,
        },
      },
    });
    createdTodoId = "";
  });

  it("rejects variables outside the selected registered operation", async () => {
    const result = await mcp.call<{
      success: boolean;
      error: string;
      message: string;
    }>("run_graphql_operation", {
      operationId: "viewer.todos.v1",
      variables: {
        document: "query Arbitrary { viewer { profile { email } } }",
      },
      locale: "zh-cn",
    });

    expect(result).toMatchObject({
      success: false,
      error: "BAD_USER_INPUT",
      message: "Unknown variable: document.",
    });
  });

  it("returns an exact insufficient-scope challenge for reauthorization", async () => {
    const limitedMcp = await createMcpHarness(userId, [
      restReadScope("homework"),
    ]);
    try {
      const result = await limitedMcp.callToolResult("run_graphql_operation", {
        operationId: "viewer.todos.v1",
        variables: {},
        locale: "zh-cn",
      });

      expect(result).toMatchObject({
        isError: true,
        structuredContent: {
          success: false,
          error: "FORBIDDEN",
          requiredScopes: [restReadScope("todo")],
        },
      });
      expect(result._meta?.["mcp/www_authenticate"]).toEqual([
        expect.stringContaining('error="insufficient_scope"'),
      ]);
      expect(result._meta?.["mcp/www_authenticate"]).toEqual([
        expect.stringContaining(`scope="${restReadScope("todo")}"`),
      ]);
    } finally {
      await limitedMcp.close();
    }
  });

  it("enforces resolver scopes for arbitrary documents", async () => {
    const limitedMcp = await createMcpHarness(userId, [
      restReadScope("homework"),
    ]);
    try {
      const result = await limitedMcp.callToolResult("run_graphql_operation", {
        document: "query ScopedTodos { viewer { todos { items { id } } } }",
        operationName: "ScopedTodos",
        variables: {},
        locale: "zh-cn",
      });

      expect(result).toMatchObject({
        isError: true,
        structuredContent: {
          success: false,
          errors: [
            expect.objectContaining({
              extensions: expect.objectContaining({
                code: "FORBIDDEN",
                requiredScopes: [restReadScope("todo")],
              }),
            }),
          ],
        },
      });
      expect(result._meta?.["mcp/www_authenticate"]).toEqual([
        expect.stringContaining(`scope="${restReadScope("todo")}"`),
      ]);
    } finally {
      await limitedMcp.close();
    }
  });

  it("preflights every mutation scope before any selected field executes", async () => {
    const todoOnlyMcp = await createMcpHarness(userId, [
      restWriteScope("todo"),
    ]);
    const title = `${marker}-mixed-scope`;
    try {
      const result = await todoOnlyMcp.callToolResult("run_graphql_operation", {
        document: /* GraphQL */ `
            mutation MixedScopes($input: CreateTodoInput!) {
              createTodo(input: $input) { id }
              saveBusPreferences(input: { showDepartedTrips: false }) {
                showDepartedTrips
              }
            }
          `,
        operationName: "MixedScopes",
        variables: { input: { title } },
        confirmed: true,
        locale: "zh-cn",
      });

      expect(result).toMatchObject({
        isError: true,
        structuredContent: {
          success: false,
          error: "FORBIDDEN",
          requiredScopes: [restWriteScope("bus")],
        },
      });
      expect(await prisma.todo.count({ where: { title } })).toBe(0);
    } finally {
      await todoOnlyMcp.close();
    }
  });

  it("preflights only mutation fields included by GraphQL directives", async () => {
    const todoOnlyMcp = await createMcpHarness(userId, [
      restWriteScope("todo"),
    ]);
    const document = /* GraphQL */ `
      mutation ConditionalScopes(
        $input: CreateTodoInput!
        $skipBus: Boolean!
        $includeBus: Boolean!
      ) {
        created: createTodo(input: $input) { id }
        ...BusMutation @skip(if: $skipBus) @include(if: $includeBus)
      }

      fragment BusMutation on Mutation {
        preferences: saveBusPreferences(
          input: { showDepartedTrips: false }
        ) { showDepartedTrips }
      }
    `;
    try {
      for (const [suffix, skipBus, includeBus] of [
        ["skip", true, true],
        ["exclude", false, false],
      ] as const) {
        const title = `${marker}-${suffix}-bus`;
        const result = await todoOnlyMcp.call<{
          success: boolean;
          data: { created: { id: string } };
        }>("run_graphql_operation", {
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
        createdTodoId = result.data.created.id;
        await withUserDbContext(userId, () =>
          prisma.todo.delete({ where: { id: createdTodoId } }),
        );
        createdTodoId = "";
      }

      const blockedTitle = `${marker}-included-bus`;
      const blocked = await todoOnlyMcp.callToolResult(
        "run_graphql_operation",
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
          requiredScopes: [restWriteScope("bus")],
        },
      });
      expect(await prisma.todo.count({ where: { title: blockedTitle } })).toBe(
        0,
      );
    } finally {
      await todoOnlyMcp.close();
    }
  });
});
