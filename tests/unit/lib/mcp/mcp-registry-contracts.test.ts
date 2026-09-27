import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { beforeAll, expect, it } from "vitest";
import { z } from "zod";
import { createMcpServer } from "@/lib/mcp/server";
import {
  assertRegisteredMcpToolMetadata,
  installMcpToolDescriptorDefaults,
} from "@/lib/mcp/tool-descriptors";
import { getMcpToolOutputSchema } from "@/lib/mcp/tool-output-schemas";
import { getRequiredMcpScopes, isPublicMcpTool } from "@/lib/mcp/tool-scopes";
import { readSpecification } from "../../../../scripts/specifications/yaml";

type WireTool = Awaited<ReturnType<Client["listTools"]>>["tools"][number] & {
  securitySchemes?: unknown;
};
let tools: WireTool[];
let instructions: string | undefined;
beforeAll(async () => {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const send = serverTransport.send.bind(serverTransport);
  let wireTools: typeof tools | undefined;
  serverTransport.send = async (message, options) => {
    if ("result" in message && Array.isArray(message.result.tools)) {
      wireTools = structuredClone(message.result.tools) as typeof tools;
    }
    return send(message, options);
  };
  const server = createMcpServer();
  const client = new Client({ name: "registry-contract", version: "1" });
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    await client.listTools();
    if (!wireTools) throw new Error("Missing wire tools/list response");
    tools = wireTools;
    instructions = client.getInstructions();
  } finally {
    await client.close();
    await server.close();
  }
});

it("mcp.personal-workspace-focus", async () => {
  const spec = await readSpecification<{
    capabilities: { "tool-groups": { mcp: { groups: { tools: string[] }[] } } };
  }>("docs/features/mcp.yaml");
  const expected = spec.capabilities["tool-groups"].mcp.groups.flatMap(
    (group) => group.tools,
  );
  const actual = tools.map((tool) => tool.name);
  expect(actual.sort()).toEqual([...new Set(expected)].sort());
  expect(expected.length).toBe(new Set(expected).size);
  expect(actual).toContain("community_comment_create");
  expect(actual).toContain("community_comment_delete");
  for (const tool of tools) {
    expect(tool.name).toMatch(
      /^(account|catalog|community|workspace)_|^graphql_operation_run$/,
    );
    expect(tool.name).not.toMatch(/admin|moderation|suspension|governance/);
    expect(
      getRequiredMcpScopes(tool.name).some((scope) =>
        /admin|moderation|governance/.test(scope),
      ),
    ).toBe(false);
  }
});

it("mcp.openai-compatible-descriptors", () => {
  expect(tools.length).toBeGreaterThan(0);
  for (const tool of tools) {
    expect(tool.title, tool.name).toEqual(expect.any(String));
    expect(tool.title?.trim().length, tool.name).toBeGreaterThan(0);
    expect(tool.outputSchema, tool.name).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: expect.arrayContaining(["success"]),
      properties: { success: { type: "boolean" } },
    });
    expect(tool.annotations, tool.name).toMatchObject({
      readOnlyHint: expect.any(Boolean),
      destructiveHint: expect.any(Boolean),
      openWorldHint: expect.any(Boolean),
    });
    const metadata = tool._meta?.securitySchemes;
    expect(tool.securitySchemes, tool.name).toEqual(metadata);
    if (isPublicMcpTool(tool.name))
      expect(metadata, tool.name).toEqual([{ type: "noauth" }]);
    else
      expect(metadata, tool.name).toEqual([
        { type: "oauth2", scopes: getRequiredMcpScopes(tool.name) },
      ]);
  }
  expect(
    tools.find((tool) => tool.name === "graphql_operation_run")?.annotations,
  ).toMatchObject({
    readOnlyHint: false,
    destructiveHint: true,
    openWorldHint: true,
  });
});

it("mcp.tool-registry-completeness", async () => {
  const server = new McpServer({ name: "unregistered-contract", version: "1" });
  installMcpToolDescriptorDefaults(server);
  server.registerTool(
    "unregistered_contract_tool",
    { description: "Missing explicit scope and schema." },
    async () => ({ content: [] }),
  );
  try {
    expect(() => assertRegisteredMcpToolMetadata(server)).toThrow(
      /scope metadata: unregistered_contract_tool; output schemas: unregistered_contract_tool/,
    );
    const complete = createMcpServer();
    try {
      expect(() => assertRegisteredMcpToolMetadata(complete)).not.toThrow();
    } finally {
      await complete.close();
    }
  } finally {
    await server.close();
  }
});

it("mcp.aggregate-before-fanout", () => {
  expect(instructions).toContain(
    "Use workspace_snapshot_get or workspace_overview_get before fanning out",
  );
  expect(instructions).toContain("workspace_subscription_list");
  for (const name of [
    "workspace_snapshot_get",
    "workspace_schedule_next",
    "workspace_deadline_list",
    "workspace_schedule_list",
    "workspace_exam_list",
    "workspace_homework_list",
  ])
    expect(
      tools.find((tool) => tool.name === name),
      name,
    ).toBeDefined();
  expect(
    tools.find((tool) => tool.name === "workspace_schedule_next")?.description,
  ).toMatch(/next/i);
  expect(
    tools.find((tool) => tool.name === "workspace_deadline_list")?.description,
  ).toMatch(/deadline/i);
});

it("mcp.error-classification-shape", () => {
  let checked = 0;
  for (const tool of tools) {
    const properties = tool.outputSchema?.properties as
      | Record<string, unknown>
      | undefined;
    if (!properties?.error) continue;
    checked++;
    expect(properties.error, tool.name).toEqual({ type: "string" });
    const schema = getMcpToolOutputSchema(tool.name);
    const failure = {
      success: false,
      error: "not_found",
      message: "No matching record",
    };
    expect(schema.safeParse(failure).success, tool.name).toBe(true);
    for (const error of [null, 1, false, {}, ["not_found"]]) {
      expect(schema.safeParse({ ...failure, error }).success, tool.name).toBe(
        false,
      );
    }
  }
  expect(checked).toBeGreaterThan(0);
});

function inspect(schema: unknown, path: string): void {
  if (typeof schema === "boolean") {
    expect(schema, path).toBe(false);
    return;
  }
  if (!schema || typeof schema !== "object")
    throw new Error(`Missing schema at ${path}`);
  const node = schema as Record<string, unknown>;
  expect(Object.keys(node).length, path).toBeGreaterThan(0);
  for (const [key, field] of Object.entries(
    (node.properties ?? {}) as Record<string, unknown>,
  )) {
    inspect(field, `${path}.${key}`);
  }
  if (node.items) inspect(node.items, `${path}[]`);
  if (
    node.additionalProperties &&
    typeof node.additionalProperties === "object"
  )
    inspect(node.additionalProperties, `${path}.*`);
  for (const union of ["anyOf", "oneOf", "allOf"]) {
    if (Array.isArray(node[union]))
      for (const [index, variant] of node[union].entries())
        inspect(variant, `${path}.${union}[${index}]`);
  }
  for (const [key, definition] of Object.entries(
    (node.$defs ?? {}) as Record<string, unknown>,
  ))
    inspect(definition, `${path}.$defs.${key}`);
}

it("mcp.typed-community-output-fields", () => {
  const community = tools.filter((tool) => tool.name.startsWith("community_"));
  expect(community.length).toBeGreaterThan(0);
  for (const tool of community)
    inspect(tool.outputSchema, `${tool.name}.output`);
  const viewer = {
    userId: "viewer",
    name: null,
    image: null,
    isAdmin: false,
    isAuthenticated: true,
    isSuspended: false,
    suspensionReason: null,
    suspensionExpiresAt: null,
  };
  const comment = {
    id: "comment",
    body: "text",
    visibility: "public",
    status: "active",
    author: null,
    authorHidden: true,
    isAnonymous: true,
    isAuthor: false,
    createdAt: "2026-09-01T00:00:00+08:00",
    updatedAt: "2026-09-01T00:00:00+08:00",
    parentId: null,
    rootId: null,
    replies: [],
    repliesNextCursor: null,
    attachments: [],
    reactions: [],
    canReact: false,
    canReply: false,
    canEdit: false,
    canDelete: false,
    canModerate: false,
  };
  const target = {
    sectionId: 1,
    courseId: null,
    teacherId: null,
    sectionTeacherId: null,
    sectionTeacherSectionId: null,
    sectionTeacherTeacherId: null,
    sectionTeacherSectionJwId: null,
    sectionTeacherSectionCode: null,
    sectionTeacherTeacherName: null,
    sectionTeacherCourseJwId: null,
    sectionTeacherCourseName: null,
    homeworkId: null,
    youngEventId: null,
    youngId: null,
    homeworkTitle: null,
    homeworkSectionJwId: null,
    homeworkSectionCode: null,
    sectionJwId: 1001,
    sectionCode: "CS1001.01",
    courseJwId: null,
    courseName: null,
    teacherName: null,
    youngEventName: null,
  };
  for (const [name, key, valid] of [
    ["community_comment_get", "viewer", viewer],
    ["community_comment_get", "target", target],
    ["community_comment_replies", "viewer", viewer],
    ["community_comment_update", "comment", comment],
    ["community_description_get", "target", { type: "section", targetId: 1 }],
    [
      "community_description_set",
      "target",
      { type: "homework", targetId: "homework-id" },
    ],
    ["community_section_homework_delete", "alreadyDeleted", true],
  ] as const) {
    const output = getMcpToolOutputSchema(name);
    if (!(output instanceof z.ZodObject))
      throw new Error(`Expected object schema for ${name}`);
    const field = output.shape[key];
    expect(field.safeParse(valid).success, `${name}.${key} valid`).toBe(true);
    for (const value of [0, "invalid", [], null])
      expect(field.safeParse(value).success, `${name}.${key} invalid`).toBe(
        false,
      );
  }
});

it("mcp.typed-bus-output-fields", () => {
  const bus = tools.filter((tool) =>
    /^(catalog|workspace)_bus_/.test(tool.name),
  );
  expect(bus).toHaveLength(7);
  for (const tool of bus) inspect(tool.outputSchema, `${tool.name}.output`);
  for (const [name, key, valid, invalid] of [
    [
      "catalog_bus_route_list",
      "routes",
      [{ stops: [{ stopOrder: 0, campusId: 1, campusName: "East" }] }],
      [{ stops: ["invalid"] }],
    ],
    [
      "catalog_bus_route_get",
      "weekday",
      [{ position: 1, stopTimes: [{ stopOrder: 0, time: "08:00" }] }],
      [{ position: 1, stopTimes: [true] }],
    ],
    [
      "catalog_bus_departure_next",
      "departures",
      [{ departureEstimated: true }],
      [{ departureEstimated: "yes" }],
    ],
    ["workspace_bus_preferences_get", "preference", null, 1],
    [
      "workspace_bus_preferences_set",
      "preference",
      {
        preferredOriginCampusId: 1,
        preferredDestinationCampusId: null,
        showDepartedTrips: false,
      },
      {
        preferredOriginCampusId: "1",
        preferredDestinationCampusId: null,
        showDepartedTrips: false,
      },
    ],
  ] as const) {
    const output = getMcpToolOutputSchema(name);
    if (!(output instanceof z.ZodObject))
      throw new Error(`Expected object schema for ${name}`);
    const field = output.shape[key];
    expect(field.safeParse(valid).success, `${name}.${key} valid`).toBe(true);
    expect(field.safeParse(invalid).success, `${name}.${key} invalid`).toBe(
      false,
    );
  }
});

it("mcp.typed-output-fields", () => {
  const other = tools.filter(
    (tool) =>
      !tool.name.startsWith("community_") &&
      !/^(catalog|workspace)_bus_/.test(tool.name),
  );
  expect(other.length).toBeGreaterThan(0);
  for (const tool of other) inspect(tool.outputSchema, `${tool.name}.output`);
  for (const [name, key, valid, invalid] of [
    [
      "workspace_homework_completion_set",
      "completion",
      { homeworkId: "homework", completed: false, completedAt: null },
      { completed: "false" },
    ],
    ["workspace_link_pin_list", "pinnedSlugs", ["library"], [3]],
    [
      "workspace_calendar_event_list",
      "events",
      [
        {
          type: "todo_due",
          at: "2026-09-01T08:00:00+08:00",
          payload: { id: "todo", title: "Task", completed: false },
        },
      ],
      [
        {
          type: "todo_due",
          at: "2026-09-01T08:00:00+08:00",
          payload: { completed: "no" },
        },
      ],
    ],
    [
      "workspace_overview_get",
      "overview",
      {
        pendingTodosCount: 1,
        pendingHomeworksCount: 2,
        todaySchedulesCount: 3,
        upcomingExamsCount: 4,
      },
      { pendingTodosCount: "1" },
    ],
    [
      "catalog_link_list",
      "links",
      [
        {
          slug: "library",
          title: "Library",
          url: "https://library.example",
          description: "Library",
          icon: "book",
          group: "study",
        },
      ],
      [{ slug: false }],
    ],
  ] as const) {
    const output = getMcpToolOutputSchema(name);
    if (!(output instanceof z.ZodObject))
      throw new Error(`Expected object schema for ${name}`);
    expect(
      output.shape[key].safeParse(valid).success,
      `${name}.${key} valid`,
    ).toBe(true);
    expect(
      output.shape[key].safeParse(invalid).success,
      `${name}.${key} invalid`,
    ).toBe(false);
  }
});
