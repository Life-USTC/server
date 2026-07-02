import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it } from "vitest";
import { createMcpServer } from "@/lib/mcp/server";
import { installMcpToolDescriptorDefaults } from "@/lib/mcp/tool-descriptors";
import { getMcpToolOutputSchema } from "@/lib/mcp/tool-output-schemas";
import { jsonToolResult } from "@/lib/mcp/tools/_helpers";
import { restReadScope, restWriteScope } from "@/lib/oauth/constants";

async function listTools() {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const mcpServer = createMcpServer();
  const client = new Client({
    name: "unit-test-client",
    version: "1.0.0",
  });

  await mcpServer.connect(serverTransport);
  await client.connect(clientTransport);

  try {
    return await client.listTools();
  } finally {
    await client.close();
    await mcpServer.close();
  }
}

type ToolListResult = Awaited<ReturnType<typeof listTools>>;
type JsonSchemaObject = {
  anyOf?: JsonSchemaObject[];
  items?: JsonSchemaObject;
  properties?: Record<string, JsonSchemaObject>;
  type?: string;
};

function outputSchema(result: ToolListResult, name: string) {
  const tool = result.tools.find((item) => item.name === name);
  expect(tool).toBeDefined();

  return tool?.outputSchema as JsonSchemaObject | undefined;
}

function outputSchemaKeys(result: ToolListResult, name: string) {
  return Object.keys(outputSchema(result, name)?.properties ?? {});
}

describe("MCP tool descriptors", () => {
  it("exposes OpenAI-compatible auth metadata and read annotations", async () => {
    const result = await listTools();
    const tool = result.tools.find((item) => item.name === "list_my_todos");

    expect(tool).toMatchObject({
      title: "List My Todos",
      annotations: {
        title: "List My Todos",
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        securitySchemes: [{ type: "oauth2", scopes: [restReadScope("todo")] }],
      },
    });
  });

  it("marks personal overwrite tools as closed-world writes", async () => {
    const result = await listTools();
    const tool = result.tools.find((item) => item.name === "update_my_todo");

    expect(tool).toMatchObject({
      title: "Update My Todo",
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false,
      },
      _meta: {
        securitySchemes: [{ type: "oauth2", scopes: [restWriteScope("todo")] }],
      },
    });
  });

  it("marks collaborative publish tools as open-world writes", async () => {
    const result = await listTools();
    const tool = result.tools.find((item) => item.name === "create_comment");

    expect(tool).toMatchObject({
      title: "Create Comment",
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
      _meta: {
        securitySchemes: [
          { type: "oauth2", scopes: [restWriteScope("comment")] },
        ],
      },
    });
  });

  it("advertises an object output schema on every registered tool", async () => {
    const result = await listTools();

    expect(result.tools.length).toBeGreaterThan(0);
    for (const tool of result.tools) {
      expect(tool.outputSchema).toMatchObject({ type: "object" });
      expect(
        Object.keys(
          (
            tool.outputSchema as
              | { properties?: Record<string, unknown> }
              | undefined
          )?.properties ?? {},
        ),
      ).not.toHaveLength(0);
    }
  });

  it("advertises useful top-level structured content keys", async () => {
    const result = await listTools();

    expect(outputSchemaKeys(result, "list_my_todos")).toEqual(
      expect.arrayContaining(["counts", "todos", "success", "message"]),
    );
    expect(outputSchemaKeys(result, "get_my_dashboard")).toEqual(
      expect.arrayContaining(["user", "nextClass", "todos", "bus"]),
    );
    expect(outputSchemaKeys(result, "create_comment")).toEqual(
      expect.arrayContaining(["id", "success", "error", "message"]),
    );
    expect(outputSchemaKeys(result, "get_next_buses")).toEqual(
      expect.arrayContaining(["departures", "nextAvailableDeparture"]),
    );
  });

  it("advertises shared nested schemas for stable structured outputs", async () => {
    const result = await listTools();
    const todoSchema = outputSchema(result, "list_my_todos");
    const uploadSchema = outputSchema(result, "list_my_uploads");
    const courseSearchSchema = outputSchema(result, "search_courses");

    expect(todoSchema?.properties?.counts).toMatchObject({
      type: "object",
      properties: {
        incomplete: { type: "integer" },
        completed: { type: "integer" },
        overdue: { type: "integer" },
      },
    });
    expect(todoSchema?.properties?.todos?.anyOf).toHaveLength(2);
    expect(
      todoSchema?.properties?.todos?.anyOf?.[0]?.items?.properties,
    ).toMatchObject({
      id: { type: "string" },
      title: { type: "string" },
      priority: { enum: ["low", "medium", "high"] },
    });

    expect(uploadSchema?.properties?.uploads?.anyOf?.[0]?.items).toMatchObject({
      type: "object",
      properties: {
        id: { type: "string" },
        key: { type: "string" },
        filename: { type: "string" },
        size: { type: "integer" },
      },
    });

    expect(courseSearchSchema?.properties?.pagination).toMatchObject({
      type: "object",
      properties: {
        page: { type: "integer" },
        pageSize: { type: "integer" },
        total: { type: "integer" },
        totalPages: { type: "integer" },
      },
    });
    expect(
      courseSearchSchema?.properties?.data?.anyOf?.[0]?.items?.properties,
    ).toMatchObject({
      id: { type: "integer" },
      jwId: { type: "integer" },
      code: { type: "string" },
    });
  });

  it("validates mode-aware collection output schemas", async () => {
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpServer = new McpServer({
      name: "unit-test-collection-output-schema",
      version: "1.0.0",
    });
    const todoPayload = {
      counts: {
        completed: 0,
        incomplete: 1,
        overdue: 0,
      },
      todos: [
        {
          id: "todo-1",
          title: "Read schema contract",
          priority: "medium",
          completed: false,
          content: "Keep fields compatible with compact MCP payloads.",
          dueAt: null,
          createdAt: "2026-07-02T00:00:00.000Z",
          updatedAt: "2026-07-02T00:00:00.000Z",
        },
      ],
    };
    const examPayload = {
      exams: [
        {
          id: 1,
          jwId: 1001,
          examDate: "2026-07-02T00:00:00.000Z",
          startTime: 900,
          endTime: 1100,
          examType: 2,
          examMode: null,
          examTakeCount: null,
          examRooms: [],
        },
      ],
      found: true,
    };
    installMcpToolDescriptorDefaults(mcpServer);
    mcpServer.registerTool(
      "return_todos_default",
      {
        description: "Return default todo payload through the shared helper.",
        outputSchema: getMcpToolOutputSchema("list_my_todos"),
      },
      async () => jsonToolResult(todoPayload, { mode: "default" }),
    );
    mcpServer.registerTool(
      "return_todos_summary",
      {
        description: "Return summary todo payload through the shared helper.",
        outputSchema: getMcpToolOutputSchema("list_my_todos"),
      },
      async () => jsonToolResult(todoPayload, { mode: "summary" }),
    );
    mcpServer.registerTool(
      "return_exams_default",
      {
        description:
          "Return default exam payload through the shared numeric schema.",
        outputSchema: getMcpToolOutputSchema("list_exams_by_section"),
      },
      async () => jsonToolResult(examPayload, { mode: "default" }),
    );
    const client = new Client({
      name: "unit-test-client",
      version: "1.0.0",
    });

    await mcpServer.connect(serverTransport);
    await client.connect(clientTransport);

    try {
      const defaultResult = await client.callTool({
        name: "return_todos_default",
        arguments: {},
      });
      const summaryResult = await client.callTool({
        name: "return_todos_summary",
        arguments: {},
      });
      const examResult = await client.callTool({
        name: "return_exams_default",
        arguments: {},
      });

      expect(defaultResult.structuredContent).toMatchObject({
        counts: todoPayload.counts,
        todos: [expect.objectContaining({ id: "todo-1" })],
      });
      expect(summaryResult.structuredContent).toMatchObject({
        counts: todoPayload.counts,
        todos: {
          total: 1,
          items: [expect.objectContaining({ id: "todo-1" })],
        },
      });
      expect(examResult.structuredContent).toMatchObject({
        exams: [
          expect.objectContaining({
            endTime: 1100,
            examType: 2,
            startTime: 900,
          }),
        ],
      });
    } finally {
      await client.close();
      await mcpServer.close();
    }
  });

  it("validates helper results against the default output schema", async () => {
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpServer = new McpServer({
      name: "unit-test-output-schema",
      version: "1.0.0",
    });
    installMcpToolDescriptorDefaults(mcpServer);
    mcpServer.registerTool(
      "return_array",
      {
        description: "Return an array payload through the shared JSON helper.",
      },
      async () => jsonToolResult([{ id: 1 }], { mode: "full" }),
    );
    const client = new Client({
      name: "unit-test-client",
      version: "1.0.0",
    });

    await mcpServer.connect(serverTransport);
    await client.connect(clientTransport);

    try {
      const tools = await client.listTools();
      const tool = tools.tools.find((item) => item.name === "return_array");
      const result = await client.callTool({
        name: "return_array",
        arguments: {},
      });

      expect(tool?.outputSchema).toMatchObject({ type: "object" });
      expect(result.structuredContent).toEqual({ result: [{ id: 1 }] });
    } finally {
      await client.close();
      await mcpServer.close();
    }
  });
});
