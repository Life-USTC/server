import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  GRAPHQL_OPERATIONS_RESOURCE_URI,
  GRAPHQL_SCHEMA_RESOURCE_URI,
} from "@/lib/graphql/constants";
import { restReadScope } from "@/lib/oauth/constants";
import { DEV_SEED } from "../fixtures/dev-seed";
import { createMcpHarness, type McpHarness } from "./utils/mcp-harness";

describe.sequential("GraphQL MCP registered operations", () => {
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
    expect((manifest.operations as unknown[]).length).toBe(38);
    expect(JSON.stringify(manifest)).not.toContain('"document"');
  });

  it("exposes only the registered runner input, never arbitrary GraphQL", async () => {
    const { tools } = await mcp.listTools();
    const runner = tools.find((tool) => tool.name === "run_graphql_operation");

    expect(tools.map((tool) => tool.name)).not.toContain("execute_graphql");
    expect(runner).toBeDefined();
    expect(Object.keys(runner?.inputSchema.properties ?? {}).sort()).toEqual([
      "confirmed",
      "locale",
      "operationId",
      "variables",
    ]);
    expect(runner?.inputSchema.properties).not.toHaveProperty("document");
    expect(runner?.inputSchema.properties).not.toHaveProperty("query");
    expect(runner?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: true,
    });
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
});
