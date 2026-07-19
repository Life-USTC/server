import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildSchema } from "graphql";
import { describe, expect, it } from "vitest";
import { graphqlTypeDefs } from "@/lib/graphql/schema";
import { getExplicitMcpToolScopeNames } from "@/lib/mcp/tool-scopes";

type Capability = {
  id: string;
  graphql: {
    field: string | null;
    status: "intentional_gap" | "stable";
  };
  mcp: {
    tools: string[];
  };
  notes?: string[];
  rest: string[];
};

type CapabilityMatrix = {
  capabilities: Capability[];
  schemaVersion: number;
};

const matrixPath = fileURLToPath(
  new URL("../../docs/graphql/mutation-capabilities.json", import.meta.url),
);
const openApiPath = fileURLToPath(
  new URL("../../public/openapi.generated.json", import.meta.url),
);

async function readMatrix() {
  return JSON.parse(await readFile(matrixPath, "utf8")) as CapabilityMatrix;
}

describe("GraphQL mutation capability matrix", () => {
  it("maps every stable SDL mutation exactly once", async () => {
    const matrix = await readMatrix();
    const schema = buildSchema(graphqlTypeDefs);
    const schemaFields = Object.keys(
      schema.getMutationType()?.getFields() ?? {},
    ).sort();
    const stableFields = matrix.capabilities
      .filter((capability) => capability.graphql.status === "stable")
      .map((capability) => capability.graphql.field)
      .sort();

    expect(matrix.schemaVersion).toBe(1);
    expect(stableFields).toEqual(schemaFields);
  });

  it("keeps IDs and stable fields unique and explains every gap", async () => {
    const matrix = await readMatrix();
    const ids = matrix.capabilities.map((capability) => capability.id);
    const stableFields = matrix.capabilities
      .filter((capability) => capability.graphql.status === "stable")
      .map((capability) => capability.graphql.field);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(stableFields).size).toBe(stableFields.length);
    for (const capability of matrix.capabilities) {
      if (capability.graphql.status === "intentional_gap") {
        expect(capability.graphql.field).toBeNull();
        expect(capability.notes?.join(" ").trim()).toBeTruthy();
      } else {
        expect(capability.graphql.field).toEqual(expect.any(String));
      }
    }
  });

  it("references only checked-in REST operations and scoped MCP tools", async () => {
    const [matrix, openApi] = await Promise.all([
      readMatrix(),
      readFile(openApiPath, "utf8").then(
        (text) =>
          JSON.parse(text) as {
            paths: Record<string, Record<string, unknown>>;
          },
      ),
    ]);
    const mcpTools = new Set(getExplicitMcpToolScopeNames());

    for (const capability of matrix.capabilities) {
      for (const restOperation of capability.rest) {
        const [method, rawPath, ...extra] = restOperation.split(" ");
        const path = rawPath.replace(/\[([^\]]+)\]/g, "{$1}");
        expect(extra, `${capability.id} has an invalid REST operation`).toEqual(
          [],
        );
        expect(
          openApi.paths[path]?.[method.toLowerCase()],
          `${capability.id} references missing ${restOperation}`,
        ).toBeTruthy();
      }
      for (const tool of capability.mcp.tools) {
        expect(
          mcpTools.has(tool),
          `${capability.id} references missing MCP tool ${tool}`,
        ).toBe(true);
      }
    }
  });
});
