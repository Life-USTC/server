import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  GRAPHQL_OPERATIONS_RESOURCE_URI,
  GRAPHQL_SCHEMA_RESOURCE_URI,
} from "@/lib/graphql/constants";
import { createMcpHarness, type McpHarness } from "./utils/mcp-harness";

describe("GraphQL MCP resources", () => {
  let mcp: McpHarness;

  beforeAll(async () => {
    mcp = await createMcpHarness("graphql-resource-test");
  });

  afterAll(async () => {
    await mcp.close();
  });

  it("lists and reads the canonical SDL and operations manifest", async () => {
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
    expect(operations.contents[0]).toMatchObject({
      uri: GRAPHQL_OPERATIONS_RESOURCE_URI,
      mimeType: "application/json",
      text: '{\n  "schemaVersion": 1,\n  "operations": []\n}\n',
    });
  });

  it("does not expose arbitrary GraphQL execution as an MCP tool", async () => {
    const { tools } = await mcp.listTools();

    expect(tools.map((tool) => tool.name)).not.toContain("execute_graphql");
    expect(tools.map((tool) => tool.name)).not.toContain(
      "run_graphql_operation",
    );
  });
});
