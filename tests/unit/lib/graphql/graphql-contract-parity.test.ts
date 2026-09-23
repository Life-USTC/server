import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildSchema, type GraphQLFieldMap, isObjectType } from "graphql";
import { describe, expect, it } from "vitest";
import { graphqlTypeDefs } from "@/lib/graphql/schema";
import {
  getRequiredMcpScopes,
  hasExplicitMcpToolScopes,
} from "@/lib/mcp/tool-scopes";
import { OAUTH_SCOPES } from "@/lib/oauth/scope-registry";

const contractsDirectory = fileURLToPath(
  new URL("../../../../docs/contracts/", import.meta.url),
);

type GraphqlFieldContract = {
  arguments?: Record<string, string>;
  name: string;
  parent?: string;
  returns: string;
  required_scopes?: string[];
  mcp_equivalent?: string;
  status?: "stable" | "planned" | "unavailable";
};

type ContractModule = {
  capabilities?: Record<
    string,
    {
      graphql?:
        | string
        | {
            queries?: GraphqlFieldContract[];
            mutations?: GraphqlFieldContract[];
            fields?: GraphqlFieldContract[];
          };
    }
  >;
};

async function collectContractFields(kind: "queries" | "mutations" | "fields") {
  const filenames = (await readdir(contractsDirectory))
    .filter((filename) => filename.endsWith(".json"))
    .sort();
  const fields: GraphqlFieldContract[] = [];

  for (const filename of filenames) {
    const module = JSON.parse(
      await readFile(`${contractsDirectory}${filename}`, "utf8"),
    ) as ContractModule;
    for (const capability of Object.values(module.capabilities ?? {})) {
      if (
        typeof capability.graphql !== "object" ||
        capability.graphql == null
      ) {
        continue;
      }
      fields.push(
        ...(capability.graphql[kind] ?? []).filter(
          (field) =>
            field.status !== "planned" && field.status !== "unavailable",
        ),
      );
    }
  }
  return fields;
}

type GraphqlFieldShape = {
  arguments: Record<string, string>;
  returns: string;
};

function sortedRecord(record: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function contractFieldMap(
  fields: GraphqlFieldContract[],
  expectedParent:
    | "Query"
    | "Mutation"
    | "Catalog"
    | "Workspace"
    | "Community"
    | "Account",
) {
  const map = new Map<string, GraphqlFieldShape>();
  for (const field of fields) {
    const validParent =
      field.parent === expectedParent ||
      ((expectedParent === "Query" || expectedParent === "Mutation") &&
        field.parent === undefined);
    if (!validParent) continue;
    if (map.has(field.name)) {
      throw new Error(`Duplicate GraphQL contract field: ${field.name}`);
    }
    map.set(field.name, {
      arguments: sortedRecord(field.arguments ?? {}),
      returns: field.returns,
    });
  }
  return Object.fromEntries(
    [...map].sort(([left], [right]) => left.localeCompare(right)),
  );
}

function schemaFieldMap(fields: GraphQLFieldMap<unknown, unknown> | undefined) {
  return Object.fromEntries(
    Object.entries(fields ?? {})
      .map(
        ([name, field]) =>
          [
            name,
            {
              arguments: sortedRecord(
                Object.fromEntries(
                  field.args.map((argument) => [
                    argument.name,
                    String(argument.type),
                  ]),
                ),
              ),
              returns: String(field.type),
            },
          ] as const,
      )
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

describe("GraphQL contract and SDL parity", () => {
  it("documents valid OAuth scopes matching native MCP equivalents", async () => {
    const groups = await Promise.all(
      (["queries", "mutations", "fields"] as const).map(collectContractFields),
    );
    const scopedFields = groups.flat().filter((field) => field.required_scopes);
    expect(scopedFields.length).toBeGreaterThan(0);
    for (const field of scopedFields) {
      const scopes = field.required_scopes ?? [];
      for (const scope of scopes) {
        expect(
          OAUTH_SCOPES,
          `${field.name}: unsupported scope ${scope}`,
        ).toContain(scope);
      }
      const tool = field.mcp_equivalent;
      // The registered GraphQL runner resolves scopes per operation instead of
      // advertising every operation's scopes on its transport descriptor.
      if (tool && tool !== "graphql_operation_run") {
        expect(
          hasExplicitMcpToolScopes(tool),
          `${field.name}: unknown MCP tool ${tool}`,
        ).toBe(true);
        expect([...scopes].sort(), field.name).toEqual(
          getRequiredMcpScopes(tool).sort(),
        );
      }
    }
  });

  it("keeps stable scope and mutation signatures aligned", async () => {
    const schema = buildSchema(graphqlTypeDefs);
    const [queryContracts, mutationContracts, scopeContracts] =
      await Promise.all([
        collectContractFields("queries"),
        collectContractFields("mutations"),
        collectContractFields("fields"),
      ]);

    expect(contractFieldMap(queryContracts, "Query")).toEqual(
      schemaFieldMap(schema.getQueryType()?.getFields()),
    );
    expect(contractFieldMap(mutationContracts, "Mutation")).toEqual(
      schemaFieldMap(schema.getMutationType()?.getFields()),
    );
    for (const parent of [
      "Catalog",
      "Workspace",
      "Community",
      "Account",
    ] as const) {
      const type = schema.getType(parent);
      expect(isObjectType(type)).toBe(true);
      const contracts = [...queryContracts, ...scopeContracts];
      expect(contractFieldMap(contracts, parent)).toEqual(
        schemaFieldMap(isObjectType(type) ? type.getFields() : {}),
      );
    }
  });
});
