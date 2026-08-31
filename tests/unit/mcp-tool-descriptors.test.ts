import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it } from "vitest";
import * as z from "zod";
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
  getMcpToolOutputSchemaForMode,
} from "@/lib/mcp/tool-output-schemas";
import { jsonToolResult } from "@/lib/mcp/tools/_shared/helpers";
import { restReadScope, restWriteScope } from "@/lib/oauth/constants";
import mcpContract from "../../docs/contracts/mcp.json";

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
  maxLength?: number;
  pattern?: string;
  properties?: Record<string, JsonSchemaObject>;
  required?: string[];
  type?: string;
};

function expectNestedExtrasRejected(
  schema: z.ZodType,
  payload: unknown,
  paths: ReadonlyArray<ReadonlyArray<string | number>>,
) {
  const validResult = schema.safeParse(payload);
  expect(
    validResult.success,
    validResult.success ? undefined : JSON.stringify(validResult.error.issues),
  ).toBe(true);
  for (const path of paths) {
    const candidate = structuredClone(payload) as Record<string, unknown>;
    let target: unknown = candidate;
    for (const segment of path) {
      if (typeof segment === "number") {
        target = (target as unknown[])[segment];
      } else {
        target = (target as Record<string, unknown>)[segment];
      }
    }
    (target as Record<string, unknown>).unexpectedNestedField = true;
    expect(schema.safeParse(candidate).success, path.join(".")).toBe(false);
  }
}

function outputSchema(result: ToolListResult, name: string) {
  const tool = result.tools.find((item) => item.name === name);
  expect(tool).toBeDefined();

  return tool?.outputSchema as JsonSchemaObject | undefined;
}

function outputSchemaKeys(result: ToolListResult, name: string) {
  return Object.keys(outputSchema(result, name)?.properties ?? {});
}

function inputSchema(result: ToolListResult, name: string) {
  const tool = result.tools.find((item) => item.name === name);
  expect(tool).toBeDefined();

  return tool?.inputSchema as JsonSchemaObject | undefined;
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
        securitySchemes: [
          { type: "oauth2", scopes: [restReadScope("workspace.todo")] },
        ],
      },
    });
    expect(wireTool).toMatchObject({
      securitySchemes: [
        { type: "oauth2", scopes: [restReadScope("workspace.todo")] },
      ],
      _meta: {
        securitySchemes: [
          { type: "oauth2", scopes: [restReadScope("workspace.todo")] },
        ],
      },
    });
  });

  it("advertises public catalog tools as noauth", async () => {
    const result = await listTools();
    const tool = result.tools.find(
      (item) => item.name === "catalog_course_search",
    );
    const wireResult = await listToolsWireResult();
    const wireTool = wireResult.tools.find(
      (item) => item.name === "catalog_course_search",
    );

    expect(tool).toMatchObject({
      annotations: { readOnlyHint: true },
      _meta: { securitySchemes: [{ type: "noauth" }] },
    });
    expect(wireTool).toMatchObject({
      securitySchemes: [{ type: "noauth" }],
      _meta: { securitySchemes: [{ type: "noauth" }] },
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
        securitySchemes: [
          { type: "oauth2", scopes: [restWriteScope("workspace.todo")] },
        ],
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
          { type: "oauth2", scopes: [restWriteScope("community.comment")] },
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
    expect(outputSchemaKeys(result, "community_comment_replies")).toEqual(
      expect.arrayContaining(["found", "rootId", "thread", "nextCursor"]),
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
        "saturday",
        "sunday",
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

  it("advertises the shared bus versionKey boundary", async () => {
    const result = await listTools();

    for (const name of [
      "catalog_bus_timetable_get",
      "catalog_bus_route_get",
      "catalog_bus_route_search",
      "catalog_bus_departure_next",
    ]) {
      expect(inputSchema(result, name)?.properties?.versionKey).toMatchObject({
        maxLength: 120,
        pattern: "^[A-Za-z0-9][A-Za-z0-9._-]*$",
      });
    }
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

  it("advertises assistant dashboard tool hierarchy", async () => {
    const result = await listTools();
    const description = (name: string) =>
      result.tools.find((tool) => tool.name === name)?.description ?? "";

    expect(description("workspace_snapshot_get")).toContain("Start here");
    expect(description("workspace_schedule_next")).toContain(
      "workspace_snapshot_get",
    );
    expect(description("workspace_schedule_next")).toContain("full mode");
  });

  it("describes personal calendar subscription without exposing a private feed URL", async () => {
    const result = await listTools();
    const description =
      result.tools.find((tool) => tool.name === "workspace_calendar_feed_get")
        ?.description ?? "";

    expect(description).toBe(
      "Get the current user's calendar subscription information and subscribed sections. This MCP tool never returns a personal iCal feed URL, calendar path, credential, or token. Subscribing is not official USTC enrollment.",
    );
    expect(description).not.toContain(
      "Get subscribed sections and the personal iCal calendar feed URL",
    );

    expect(
      mcpContract.capabilities["tool-groups"].mcp.groups
        .flatMap((group) => group.tools)
        .filter((name) => name === "community_comment_replies"),
    ).toEqual(["community_comment_replies"]);
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
    expect(courseSearchSchema?.properties?.data?.items?.anyOf).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          properties: expect.objectContaining({
            id: expect.objectContaining({ type: "integer" }),
            jwId: expect.objectContaining({ type: "integer" }),
            code: expect.objectContaining({ type: "string" }),
          }),
        }),
      ]),
    );
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
      repliesNextCursor: null,
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
        name: "community_comment_replies",
        compact: {
          success: true,
          found: true,
          rootId: "comment-1",
          thread: [compactComment],
          nextCursor: null,
          viewer: {},
        },
        full: {
          success: true,
          found: true,
          rootId: "comment-1",
          thread: [fullComment],
          nextCursor: null,
          viewer: {},
        },
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

  it("keeps academic compact and full schemas exact and mode-specific", () => {
    const compactCourse = {
      id: 1,
      jwId: 1001,
      code: "CS101",
      nameCn: "计算机导论",
      nameEn: "Introduction to Computer Science",
      namePrimary: "计算机导论",
      nameSecondary: "Introduction to Computer Science",
    };
    const fullCourse = {
      ...compactCourse,
      categoryId: null,
      classTypeId: null,
      classifyId: null,
      educationLevelId: null,
      gradationId: null,
      typeId: null,
      category: null,
      classType: null,
      classify: null,
      educationLevel: null,
      gradation: null,
      type: null,
    };
    const pagination = {
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    };
    const compactPayload = {
      success: true,
      data: [compactCourse],
      pagination,
    };
    const fullPayload = { success: true, data: [fullCourse], pagination };
    const defaultSchema = getMcpToolOutputSchemaForMode(
      "catalog_course_search",
      "default",
    );
    const fullSchema = getMcpToolOutputSchemaForMode(
      "catalog_course_search",
      "full",
    );

    expect(defaultSchema.safeParse(compactPayload).success).toBe(true);
    expect(defaultSchema.safeParse(fullPayload).success).toBe(false);
    expect(fullSchema.safeParse(fullPayload).success).toBe(true);
    expect(fullSchema.safeParse(compactPayload).success).toBe(false);
    expect(
      defaultSchema.safeParse({
        ...compactPayload,
        data: [{ ...compactCourse, hours: 48 }],
      }).success,
    ).toBe(false);
  });

  it("rejects unexpected nested homework and bus fields in every runtime mode", () => {
    const compactCourse = {
      id: 1,
      jwId: 1001,
      code: "CS101",
      nameCn: "计算机导论",
      nameEn: "Introduction to Computer Science",
      namePrimary: "计算机导论",
      nameSecondary: "Introduction to Computer Science",
    };
    const sectionBase = {
      id: 1,
      jwId: 2001,
      retiredAt: null,
      code: "CS101.01",
      bizTypeId: null,
      credits: 3,
      period: 48,
      periodsPerWeek: 3,
      timesPerWeek: 2,
      stdCount: 30,
      limitCount: 40,
      graduateAndPostgraduate: null,
      dateTimePlaceText: null,
      dateTimePlacePersonText: null,
      actualPeriods: null,
      theoryPeriods: null,
      practicePeriods: null,
      experimentPeriods: null,
      machinePeriods: null,
      designPeriods: null,
      testPeriods: null,
      scheduleState: null,
      suggestScheduleWeeks: null,
      suggestScheduleWeekInfo: null,
      scheduleJsonParams: null,
      selectedStdCount: null,
      remark: null,
      scheduleRemark: null,
      courseId: 1,
      semesterId: null,
      campusId: null,
      examModeId: null,
      openDepartmentId: null,
      teachLanguageId: null,
      roomTypeId: null,
    };
    const fullCourse = {
      ...compactCourse,
      categoryId: null,
      classTypeId: null,
      classifyId: null,
      educationLevelId: null,
      gradationId: null,
      typeId: null,
    };
    const compactHomework = {
      id: "homework-1",
      sectionId: 1,
      title: "Homework",
      isMajor: false,
      requiresTeam: false,
      publishedAt: null,
      submissionStartAt: null,
      submissionDueAt: null,
      deletedAt: null,
      createdAt: "2026-08-16T00:00:00.000Z",
      updatedAt: "2026-08-16T00:00:00.000Z",
      description: {
        id: "description-1",
        content: "Details",
        lastEditedAt: null,
        lastEditedById: null,
      },
      section: {
        id: sectionBase.id,
        jwId: sectionBase.jwId,
        code: sectionBase.code,
        campusId: null,
        openDepartmentId: null,
        course: compactCourse,
        semester: null,
      },
      createdBy: {
        id: "user-1",
        name: "User",
        username: "user",
        image: null,
      },
      updatedBy: null,
      deletedBy: null,
      completion: { completedAt: "2026-08-16T00:00:00.000Z" },
      commentCount: 0,
    };
    const fullHomework = {
      ...compactHomework,
      createdById: "user-1",
      updatedById: null,
      deletedById: null,
      section: {
        ...sectionBase,
        course: fullCourse,
        semester: null,
      },
      description: {
        id: "description-1",
        content: "Details",
        createdAt: "2026-08-16T00:00:00.000Z",
        updatedAt: "2026-08-16T00:00:00.000Z",
        lastEditedAt: null,
        lastEditedById: null,
        sectionId: null,
        courseId: null,
        teacherId: null,
        homeworkId: "homework-1",
      },
    };
    const {
      section: _section,
      description: _description,
      createdBy: _createdBy,
      updatedBy: _updatedBy,
      deletedBy: _deletedBy,
      ...scopedHomework
    } = compactHomework;
    const sectionHomeworkContext = {
      id: sectionBase.id,
      jwId: sectionBase.jwId,
      code: sectionBase.code,
      course: {
        jwId: compactCourse.jwId,
        code: compactCourse.code,
        nameCn: compactCourse.nameCn,
        nameEn: compactCourse.nameEn,
        namePrimary: compactCourse.namePrimary,
        nameSecondary: compactCourse.nameSecondary,
      },
      semester: null,
    };
    const compactSectionHomeworkList = {
      success: true,
      found: true,
      section: sectionHomeworkContext,
      homeworks: [scopedHomework],
    };
    const fullSectionHomeworkList = {
      success: true,
      found: true,
      section: sectionHomeworkContext,
      homeworks: [fullHomework],
    };
    const sectionHomeworkDefaultSchema = getMcpToolOutputSchemaForMode(
      "community_section_homework_list",
      "default",
    );
    const sectionHomeworkFullSchema = getMcpToolOutputSchemaForMode(
      "community_section_homework_list",
      "full",
    );
    expect(
      sectionHomeworkDefaultSchema.safeParse(compactSectionHomeworkList)
        .success,
    ).toBe(true);
    expect(
      sectionHomeworkDefaultSchema.safeParse(fullSectionHomeworkList).success,
    ).toBe(false);
    expect(
      sectionHomeworkFullSchema.safeParse(fullSectionHomeworkList).success,
    ).toBe(false);
    expect(
      sectionHomeworkFullSchema.safeParse(compactSectionHomeworkList).success,
    ).toBe(true);
    expect(
      sectionHomeworkDefaultSchema.safeParse({
        ...compactSectionHomeworkList,
        unexpected: true,
      }).success,
    ).toBe(false);
    const homeworkNestedPaths = [
      ["homework", "description"],
      ["homework", "createdBy"],
      ["homework", "completion"],
    ] as const;
    expectNestedExtrasRejected(
      getMcpToolOutputSchemaForMode(
        "community_section_homework_create",
        "default",
      ),
      { success: true, id: compactHomework.id, homework: compactHomework },
      homeworkNestedPaths,
    );
    expectNestedExtrasRejected(
      getMcpToolOutputSchemaForMode(
        "community_section_homework_create",
        "full",
      ),
      { success: true, id: fullHomework.id, homework: fullHomework },
      homeworkNestedPaths,
    );

    const campus = {
      id: 1,
      nameCn: "东区",
      nameEn: "East Campus",
      latitude: 31.8,
      longitude: 117.3,
      namePrimary: "东区",
      nameSecondary: "East Campus",
    };
    const routeCore = {
      id: 1,
      nameCn: "东区到西区",
      nameEn: "East to West",
      descriptionPrimary: "东区到西区",
      descriptionSecondary: "East to West",
    };
    const departure = {
      tripId: 1,
      routeId: 1,
      route: routeCore,
      originCampus: campus,
      destinationCampus: campus,
      departureTime: "08:00",
      arrivalTime: "08:30",
      departureEstimated: false,
      arrivalEstimated: false,
      minutesUntilDeparture: 10,
      dayType: "weekday",
      status: "upcoming",
    };
    const versionSummary = {
      key: "2026-summer",
      title: "Summer timetable",
      effectiveFrom: null,
      effectiveUntil: null,
    };
    const defaultBusPayload = {
      success: true,
      locale: "zh-cn",
      fetchedAt: "2026-08-16T00:00:00.000Z",
      version: versionSummary,
      counts: {
        campuses: 1,
        routes: 1,
        weekdayTrips: 1,
        saturdayTrips: 0,
        sundayTrips: 0,
      },
      campuses: [
        {
          id: campus.id,
          namePrimary: campus.namePrimary,
          nameSecondary: campus.nameSecondary,
        },
      ],
      routes: [routeCore],
      preferences: {
        preferredOriginCampusId: 1,
        preferredDestinationCampusId: 1,
        showDepartedTrips: false,
      },
      nextDepartures: [departure],
      nextDeparturesMessage: null,
      notice: { message: "Notice" },
    };
    expectNestedExtrasRejected(
      getMcpToolOutputSchemaForMode("catalog_bus_timetable_get", "default"),
      defaultBusPayload,
      [
        ["version"],
        ["preferences"],
        ["nextDepartures", 0],
        ["nextDepartures", 0, "route"],
        ["notice"],
      ],
    );

    const version = {
      id: 1,
      ...versionSummary,
      importedAt: "2026-08-16T00:00:00.000Z",
      notice: { message: "Version notice", url: null },
    };
    const route = {
      ...routeCore,
      stops: [{ stopOrder: 1, campus }],
    };
    const trip = {
      id: 1,
      routeId: 1,
      dayType: "weekday",
      position: 1,
      stopTimes: [
        {
          stopOrder: 1,
          campusId: 1,
          campusName: "东区",
          time: "08:00",
          minutesSinceMidnight: 480,
          isPassThrough: false,
        },
      ],
      departureTime: "08:00",
      departureMinutes: 480,
      arrivalTime: "08:30",
      arrivalMinutes: 510,
    };
    const fullBusPayload = {
      ...defaultBusPayload,
      version,
      availableVersions: [version],
      campuses: [campus],
      routes: [route],
      trips: [trip],
      notice: { message: "Notice", url: null },
    };
    expectNestedExtrasRejected(
      getMcpToolOutputSchemaForMode("catalog_bus_timetable_get", "full"),
      fullBusPayload,
      [
        ["version"],
        ["version", "notice"],
        ["availableVersions", 0],
        ["routes", 0],
        ["routes", 0, "stops", 0],
        ["trips", 0],
        ["trips", 0, "stopTimes", 0],
        ["preferences"],
        ["nextDepartures", 0],
        ["nextDepartures", 0, "route"],
        ["notice"],
      ],
    );
  });

  it("rejects stale teacher and schedule fields in compact academic output", () => {
    const pagination = {
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    };
    const teacher = {
      id: 1,
      jwId: 2001,
      personId: null,
      code: "T001",
      nameCn: "教师",
      nameEn: null,
      namePrimary: "教师",
      nameSecondary: null,
      department: null,
      teacherTitle: null,
      _count: { sections: 1 },
    };
    const schedule = {
      id: 1,
      periods: 2.5,
      date: null,
      weekday: 1,
      startTime: "07:50",
      endTime: "08:35",
      weekIndex: 1,
      customPlace: null,
      startUnit: 1,
      endUnit: 1,
      section: {
        id: 1,
        jwId: 3001,
        code: "CS101.01",
        campusId: null,
        openDepartmentId: null,
        course: {
          id: 1,
          jwId: 1001,
          code: "CS101",
          nameCn: "计算机导论",
          nameEn: null,
          namePrimary: "计算机导论",
          nameSecondary: null,
        },
        semester: null,
      },
      teachers: [],
    };

    const teacherSchema = getMcpToolOutputSchemaForMode(
      "catalog_teacher_search",
      "default",
    );
    const scheduleSchema = getMcpToolOutputSchemaForMode(
      "catalog_schedule_list",
      "default",
    );
    expect(
      teacherSchema.safeParse({
        success: true,
        data: [{ ...teacher, teacherId: 99 }],
        pagination,
      }).success,
    ).toBe(false);
    for (const staleField of ["jwId", "createdAt"] as const) {
      expect(
        scheduleSchema.safeParse({
          success: true,
          data: [{ ...schedule, [staleField]: 99 }],
          pagination,
        }).success,
      ).toBe(false);
    }
  });

  it("validates academic tool results against the requested mode branch", async () => {
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const mcpServer = new McpServer({
      name: "unit-test-academic-mode-output",
      version: "1.0.0",
    });
    installMcpToolDescriptorDefaults(mcpServer);
    const payload = {
      data: [
        {
          id: 1,
          jwId: 1001,
          code: "CS101",
          nameCn: "计算机导论",
          nameEn: null,
          namePrimary: "计算机导论",
          nameSecondary: null,
          categoryId: null,
          classTypeId: null,
          classifyId: null,
          educationLevelId: null,
          gradationId: null,
          typeId: null,
          category: null,
          classType: null,
          classify: null,
          educationLevel: null,
          gradation: null,
          type: null,
        },
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      },
    };
    mcpServer.registerTool(
      "catalog_course_search",
      {
        description: "Return a full course payload for mode validation.",
        inputSchema: { mode: z.enum(["default", "full"]) },
      },
      async () => jsonToolResult(payload, { mode: "full" }),
    );
    const client = new Client({ name: "unit-test-client", version: "1.0.0" });
    await mcpServer.connect(serverTransport);
    await client.connect(clientTransport);

    try {
      const wrongMode = await client.callTool({
        name: "catalog_course_search",
        arguments: { mode: "default" },
      });
      const fullMode = await client.callTool({
        name: "catalog_course_search",
        arguments: { mode: "full" },
      });

      expect(wrongMode.isError).toBe(true);
      expect(fullMode.structuredContent).toMatchObject({ success: true });
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
