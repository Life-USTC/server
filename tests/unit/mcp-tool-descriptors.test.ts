import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it } from "vitest";
import { createMcpServer } from "@/lib/mcp/server";
import { installMcpToolDescriptorDefaults } from "@/lib/mcp/tool-descriptors";
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

function outputSchemaKeys(result: ToolListResult, name: string) {
  const tool = result.tools.find((item) => item.name === name);
  expect(tool).toBeDefined();
  const outputSchema = tool?.outputSchema as
    | { properties?: Record<string, unknown> }
    | undefined;

  return Object.keys(outputSchema?.properties ?? {});
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
