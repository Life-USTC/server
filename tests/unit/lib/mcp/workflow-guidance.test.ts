import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { expect, it } from "vitest";
import { createMcpServer } from "@/lib/mcp/server";

// Building and enumerating the full tool schema registry is part of this audit.
it("cases.mcp-assistant-workflows.scenario-guidance-2", {
  timeout: 15_000,
}, async () => {
  const server = createMcpServer();
  const client = new Client({ name: "workflow-guide", version: "1" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const instructions = client.getInstructions();
    expect(instructions).toBeDefined();
    const { tools } = await client.listTools();
    for (const [name, scopes, description] of [
      [
        "workspace_snapshot_get",
        ["workspace.overview:read"],
        "provides broad personal context",
      ],
      [
        "workspace_schedule_next",
        ["workspace.overview:read", "workspace.schedule:read"],
        "answers the focused next-class question",
      ],
      [
        "catalog_bus_departure_next",
        [],
        "answers the focused next-bus question",
      ],
      [
        "catalog_section_match_preview",
        [],
        "is public and requires no OAuth scopes",
      ],
    ] as const) {
      const tool = tools.find((candidate) => candidate.name === name);
      expect(tool, name).toBeDefined();
      expect(instructions).toContain(`${name} ${description}`);
      const securitySchemes = tool?._meta?.securitySchemes;
      expect(securitySchemes).toEqual(
        scopes.length ? [{ type: "oauth2", scopes }] : [{ type: "noauth" }],
      );
      for (const scope of scopes) expect(instructions).toContain(scope);
      expect(tool?.inputSchema.properties?.mode).toMatchObject({
        default: "default",
      });
      expect(tool?.inputSchema.properties?.locale).toMatchObject({
        default: "zh-cn",
      });
    }
    expect(instructions).toContain("omitted mode=default and locale=zh-cn");
    expect(instructions).toContain(
      "Omitted atTime uses the server clock for snapshot, next class and next bus",
    );
    const nextBus = tools.find(
      (tool) => tool.name === "catalog_bus_departure_next",
    );
    for (const [field, value] of Object.entries({
      dayType: "auto",
      includeDeparted: false,
      limit: 5,
    })) {
      expect(nextBus?.inputSchema.properties?.[field]).toMatchObject({
        default: value,
      });
      expect(instructions).toContain(`${field}=${value}`);
    }
    expect(nextBus?.inputSchema.required).toEqual(
      expect.arrayContaining(["originCampusId", "destinationCampusId"]),
    );
    expect(instructions).toContain(
      "Supply originCampusId and destinationCampusId",
    );
    expect(instructions).toContain("current Shanghai day");
    expect(instructions).toContain(
      "without changing user data; omitted semesterId selects the current semester",
    );
    expect(instructions).toContain(
      "Review the preview before calling workspace_subscription_import with the same codes and semesterId",
    );
    expect(
      tools.find((tool) => tool.name === "workspace_subscription_import")?._meta
        ?.securitySchemes,
    ).toEqual([{ type: "oauth2", scopes: ["workspace.subscription:write"] }]);
    expect(instructions).toContain(
      "import requires workspace.subscription:write",
    );
    expect(instructions).toContain("not official course enrollment");
    expect(instructions).toContain(
      "Full mode adds only allowed fields and never relaxes privacy",
    );
    expect(instructions).toContain(
      "private calendar-feed URLs, calendar path credentials and tokens are never exposed by MCP",
    );
    expect(instructions).toContain(
      "do not request, echo or invent those secrets",
    );
  } finally {
    await client.close();
    await server.close();
  }
});
