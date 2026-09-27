import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { beforeAll, expect, it } from "vitest";
import { createMcpServer } from "@/lib/mcp/server";
import {
  assertRegisteredMcpToolMetadata,
  installMcpToolDescriptorDefaults,
} from "@/lib/mcp/tool-descriptors";
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
