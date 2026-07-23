import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it } from "vitest";
import { createMcpServer } from "@/lib/mcp/server";
import {
  assertRegisteredMcpToolMetadata,
  getRegisteredMcpToolCount,
  installMcpToolDescriptorDefaults,
  installMcpToolListCompatibility,
} from "@/lib/mcp/tool-descriptors";
import {
  getMarkdownMcpToolOutputSchemaForMode,
  getMcpToolOutputSchema,
} from "@/lib/mcp/tool-output-schemas";
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

async function listToolsWireResult() {
  const mcpServer = createMcpServer();
  const handler = (
    mcpServer.server as unknown as {
      _requestHandlers?: Map<
        string,
        (request: unknown, extra: unknown) => Promise<unknown> | unknown
      >;
    }
  )._requestHandlers?.get("tools/list");

  try {
    if (!handler) {
      throw new Error("tools/list handler is not registered");
    }

    return (await handler({ method: "tools/list" }, {})) as {
      tools: Array<{
        _meta?: Record<string, unknown>;
        name: string;
        securitySchemes?: unknown;
      }>;
    };
  } finally {
    await mcpServer.close();
  }
}

type ToolListResult = Awaited<ReturnType<typeof listTools>>;
type JsonSchemaObject = {
  additionalProperties?: boolean;
  anyOf?: JsonSchemaObject[];
  items?: JsonSchemaObject;
  properties?: Record<string, JsonSchemaObject>;
  required?: string[];
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
  it("tracks the registered tool count without reading SDK private fields", async () => {
    const server = createMcpServer();

    try {
      expect(getRegisteredMcpToolCount(server)).toBeGreaterThan(0);
    } finally {
      await server.close();
    }
  });

  it("exposes OpenAI-compatible auth metadata and read annotations", async () => {
    const result = await listTools();
    const tool = result.tools.find(
      (item) => item.name === "workspace_todo_list",
    );
    const wireResult = await listToolsWireResult();
    const wireTool = wireResult.tools.find(
      (item) => item.name === "workspace_todo_list",
    );

    expect(tool).toMatchObject({
      title: "Workspace Todo List",
      annotations: {
        title: "Workspace Todo List",
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        securitySchemes: [{ type: "oauth2", scopes: [restReadScope("todo")] }],
      },
    });
    expect(wireTool).toMatchObject({
      securitySchemes: [{ type: "oauth2", scopes: [restReadScope("todo")] }],
      _meta: {
        securitySchemes: [{ type: "oauth2", scopes: [restReadScope("todo")] }],
      },
    });
  });

  it("installs the tools/list compatibility wrapper once after registration", async () => {
    const mcpServer = new McpServer({
      name: "unit-test-list-compatibility",
      version: "1.0.0",
    });
    const protocol = mcpServer.server as unknown as {
      _requestHandlers?: Map<
        string,
        (request: unknown, extra: unknown) => Promise<unknown> | unknown
      >;
    };
    const register = (name: string) =>
      mcpServer.registerTool(
        name,
        { description: `Test tool ${name}` },
        async () => ({ content: [] }),
      );

    try {
      installMcpToolDescriptorDefaults(mcpServer);
      register("first_tool");
      const sdkListHandler = protocol._requestHandlers?.get("tools/list");
      expect(sdkListHandler).toBeDefined();

      register("second_tool");
      expect(protocol._requestHandlers?.get("tools/list")).toBe(sdkListHandler);

      installMcpToolListCompatibility(mcpServer);
      const compatibilityHandler = protocol._requestHandlers?.get("tools/list");
      expect(compatibilityHandler).toBeDefined();
      expect(compatibilityHandler).not.toBe(sdkListHandler);

      installMcpToolListCompatibility(mcpServer);
      expect(protocol._requestHandlers?.get("tools/list")).toBe(
        compatibilityHandler,
      );

      register("third_tool");
      expect(protocol._requestHandlers?.get("tools/list")).toBe(
        compatibilityHandler,
      );

      const result = (await compatibilityHandler?.(
        { method: "tools/list" },
        {},
      )) as {
        tools: Array<{ name: string; securitySchemes?: unknown }>;
      };
      expect(result.tools.map((tool) => tool.name)).toEqual([
        "first_tool",
        "second_tool",
        "third_tool",
      ]);
      for (const tool of result.tools) {
        expect(tool.securitySchemes).toEqual([
          { type: "oauth2", scopes: expect.any(Array) },
        ]);
      }
    } finally {
      await mcpServer.close();
    }
  });

  it("marks personal overwrite tools as closed-world writes", async () => {
    const result = await listTools();
    const tool = result.tools.find(
      (item) => item.name === "workspace_todo_update",
    );

    expect(tool).toMatchObject({
      title: "Workspace Todo Update",
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
    const tool = result.tools.find(
      (item) => item.name === "community_comment_create",
    );

    expect(tool).toMatchObject({
      title: "Community Comment Create",
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
      expect(tool.outputSchema).toMatchObject({
        type: "object",
        additionalProperties: false,
        required: expect.arrayContaining(["success"]),
      });
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

    expect(outputSchemaKeys(result, "workspace_todo_list")).toEqual(
      expect.arrayContaining(["counts", "todos", "success", "message"]),
    );
    expect(outputSchemaKeys(result, "workspace_snapshot_get")).toEqual(
      expect.arrayContaining(["user", "nextClass", "todos", "bus"]),
    );
    expect(outputSchemaKeys(result, "community_comment_create")).toEqual(
      expect.arrayContaining(["id", "success", "error", "message", "reason"]),
    );
    expect(outputSchemaKeys(result, "community_comment_list")).toEqual(
      expect.arrayContaining(["found", "data", "pagination", "meta"]),
    );
    expect(outputSchemaKeys(result, "workspace_upload_list")).toEqual(
      expect.arrayContaining(["data", "pagination", "meta"]),
    );
    expect(outputSchemaKeys(result, "catalog_bus_departure_next")).toEqual(
      expect.arrayContaining(["departures", "nextAvailableDeparture"]),
    );
    expect(outputSchemaKeys(result, "catalog_bus_timetable_get")).toEqual(
      expect.arrayContaining(["availableVersions", "trips", "success"]),
    );
    expect(outputSchemaKeys(result, "catalog_bus_route_get")).toEqual(
      expect.arrayContaining([
        "route",
        "weekday",
        "weekend",
        "alternateRoutes",
      ]),
    );
    expect(outputSchemaKeys(result, "workspace_bus_preferences_get")).toEqual(
      expect.arrayContaining(["preference", "success"]),
    );
    expect(outputSchemaKeys(result, "workspace_bus_preferences_set")).toEqual(
      expect.arrayContaining(["preference", "success"]),
    );
    expect(outputSchemaKeys(result, "catalog_bus_route_search")).toEqual(
      expect.arrayContaining([
        "originCampus",
        "destinationCampus",
        "total",
        "routes",
      ]),
    );
  });

  it("advertises how to recover past-term personal data", async () => {
    const result = await listTools();
    const description = (name: string) =>
      result.tools.find((tool) => tool.name === name)?.description ?? "";

    expect(description("workspace_snapshot_get")).toContain(
      "subscriptions.totalCount exceeds currentSemesterCount",
    );
    expect(description("workspace_subscription_list")).toContain(
      "across all semesters",
    );
    expect(description("workspace_homework_list")).toContain("all semesters");
    expect(description("workspace_schedule_list")).toContain("all semesters");
    expect(description("workspace_exam_list")).toContain("all semesters");
  });

  it("advertises the advisory homework writing convention", async () => {
    const result = await listTools();

    for (const name of [
      "community_section_homework_create",
      "community_section_homework_update",
    ]) {
      const description =
        result.tools.find((tool) => tool.name === name)?.description ?? "";
      expect(description).toContain("Advisory style guide only");
      expect(description).toContain("never reject a request for formatting");
      expect(description).toContain("第{N}次作业");
      expect(description).toContain("{主题}作业");
      expect(description).toContain("第一章作业");
      expect(description).toMatch(/题目.*提交方式.*提交地址.*备注/);
    }
  });

  it("advertises shared nested schemas for stable structured outputs", async () => {
    const result = await listTools();
    const todoSchema = outputSchema(result, "workspace_todo_list");
    const uploadSchema = outputSchema(result, "workspace_upload_list");
    const courseSearchSchema = outputSchema(result, "catalog_course_search");

    expect(todoSchema?.properties?.counts).toMatchObject({
      type: "object",
      properties: {
        incomplete: { type: "integer" },
        completed: { type: "integer" },
        overdue: { type: "integer" },
      },
    });
    expect(todoSchema?.properties?.todos?.items?.properties).toMatchObject({
      id: { type: "string" },
      title: { type: "string" },
      priority: { enum: ["low", "medium", "high"] },
    });

    expect(uploadSchema?.properties?.data?.items).toMatchObject({
      type: "object",
      properties: {
        id: { type: "string" },
        key: { type: "string" },
        filename: { type: "string" },
        size: { type: "integer" },
      },
    });
    expect(uploadSchema?.properties?.pagination).toMatchObject({
      type: "object",
      properties: {
        page: { type: "integer" },
        pageSize: { type: "integer" },
        total: { type: "integer" },
        totalPages: { type: "integer" },
      },
    });
    expect(uploadSchema?.properties?.meta).toMatchObject({
      type: "object",
      properties: {
        maxFileSizeBytes: { type: "integer" },
        quotaBytes: { type: "integer" },
        usedBytes: { type: "integer" },
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
      courseSearchSchema?.properties?.data?.items?.properties,
    ).toMatchObject({
      id: { type: "integer" },
      jwId: { type: "integer" },
      code: { type: "string" },
    });
  });

  it("accepts nullable not-found catalog payloads", () => {
    expect(
      getMcpToolOutputSchema("catalog_semester_current").safeParse({
        success: true,
        found: false,
        semester: null,
      }).success,
    ).toBe(true);
    expect(
      getMcpToolOutputSchema("catalog_teacher_get").safeParse({
        success: true,
        found: false,
        teacher: null,
      }).success,
    ).toBe(true);
  });

  it("accepts bus trips whose endpoint times are unavailable", () => {
    expect(
      getMcpToolOutputSchema("catalog_bus_timetable_get").safeParse({
        success: true,
        trips: [
          {
            departureTime: null,
            arrivalTime: null,
            departureMinutes: null,
            arrivalMinutes: null,
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("validates canonical collection output schemas across compatibility modes", async () => {
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
    const busPayload = {
      atTime: "2026-07-02T08:00:00.000Z",
      dayType: "weekday",
      departures: [],
      destinationCampus: null,
      hasData: true,
      message: null,
      nextAvailableDeparture: null,
      originCampus: null,
      totalRoutes: 1,
    };
    installMcpToolDescriptorDefaults(mcpServer);
    mcpServer.registerTool(
      "return_todos_default",
      {
        description: "Return default todo payload through the shared helper.",
        outputSchema: getMcpToolOutputSchema("workspace_todo_list"),
      },
      async () => jsonToolResult(todoPayload, { mode: "default" }),
    );
    mcpServer.registerTool(
      "return_todos_summary",
      {
        description: "Return summary todo payload through the shared helper.",
        outputSchema: getMcpToolOutputSchema("workspace_todo_list"),
      },
      async () => jsonToolResult(todoPayload, { mode: "summary" }),
    );
    mcpServer.registerTool(
      "return_exams_default",
      {
        description:
          "Return default exam payload through the shared numeric schema.",
        outputSchema: getMcpToolOutputSchema("catalog_section_exam_list"),
      },
      async () => jsonToolResult(examPayload, { mode: "default" }),
    );
    mcpServer.registerTool(
      "return_next_buses_default",
      {
        description: "Return default next-bus payload with a nullable message.",
        outputSchema: getMcpToolOutputSchema("catalog_bus_departure_next"),
      },
      async () => jsonToolResult(busPayload, { mode: "default" }),
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
      const busResult = await client.callTool({
        name: "return_next_buses_default",
        arguments: {},
      });

      expect(defaultResult.structuredContent).toMatchObject({
        counts: todoPayload.counts,
        todos: [expect.objectContaining({ id: "todo-1" })],
      });
      expect(summaryResult.structuredContent).toMatchObject({
        counts: todoPayload.counts,
        success: true,
        todos: [expect.objectContaining({ id: "todo-1" })],
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
      expect(busResult.structuredContent).toMatchObject({
        message: null,
        totalRoutes: 1,
      });
    } finally {
      await client.close();
      await mcpServer.close();
    }
  });

  it("keeps compact and full Markdown output schemas mutually strict", () => {
    const fullComment = {
      id: "comment-1",
      body: "Source Markdown",
      renderedBody: "<p>Source Markdown</p>",
      visibility: "public",
      status: "active",
      author: null,
      authorHidden: false,
      isAnonymous: false,
      isAuthor: true,
      createdAt: "2026-07-19T00:00:00.000Z",
      updatedAt: "2026-07-19T00:00:00.000Z",
      parentId: null,
      rootId: null,
      replies: [],
      attachments: [],
      reactions: [],
      canReact: true,
      canReply: true,
      canEdit: true,
      canDelete: true,
      canModerate: false,
    };
    const { renderedBody: _renderedBody, ...compactComment } = fullComment;
    const fullDescription = {
      id: "description-1",
      content: "Source Markdown",
      renderedHtml: "<p>Source Markdown</p>",
      updatedAt: "2026-07-19T00:00:00.000Z",
      lastEditedAt: "2026-07-19T00:00:00.000Z",
      lastEditedBy: null,
    };
    const { renderedHtml: _renderedHtml, ...compactDescription } =
      fullDescription;
    const cases = [
      {
        name: "community_comment_list",
        compact: { success: true, found: true, data: [compactComment] },
        full: { success: true, found: true, data: [fullComment] },
      },
      {
        name: "community_comment_get",
        compact: { success: true, found: true, thread: [compactComment] },
        full: { success: true, found: true, thread: [fullComment] },
      },
      {
        name: "community_description_get",
        compact: {
          success: true,
          found: true,
          description: compactDescription,
        },
        full: { success: true, found: true, description: fullDescription },
      },
      {
        name: "community_description_set",
        compact: {
          success: true,
          id: "description-1",
          updated: true,
          description: compactDescription,
        },
        full: {
          success: true,
          id: "description-1",
          updated: true,
          description: fullDescription,
        },
      },
    ] as const;

    for (const testCase of cases) {
      const compactSchema = getMarkdownMcpToolOutputSchemaForMode(
        testCase.name,
        "default",
      );
      const fullSchema = getMarkdownMcpToolOutputSchemaForMode(
        testCase.name,
        "full",
      );

      expect(compactSchema.safeParse(testCase.compact).success).toBe(true);
      expect(compactSchema.safeParse(testCase.full).success).toBe(false);
      expect(fullSchema.safeParse(testCase.full).success).toBe(true);
      expect(fullSchema.safeParse(testCase.compact).success).toBe(false);
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
      expect(result.structuredContent).toEqual({
        success: true,
        result: [{ id: 1 }],
      });
    } finally {
      await client.close();
      await mcpServer.close();
    }
  });

  it("fails startup validation for tools missing explicit metadata", async () => {
    const mcpServer = new McpServer({
      name: "unit-test-registry-completeness",
      version: "1.0.0",
    });
    installMcpToolDescriptorDefaults(mcpServer);
    mcpServer.registerTool(
      "unregistered_test_tool",
      { description: "Tool intentionally missing production metadata." },
      async () => jsonToolResult({ value: true }),
    );

    try {
      expect(() => assertRegisteredMcpToolMetadata(mcpServer)).toThrow(
        /scope metadata: unregistered_test_tool; output schemas: unregistered_test_tool/,
      );
    } finally {
      await mcpServer.close();
    }
  });
});
