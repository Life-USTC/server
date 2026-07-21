import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildSchema, type GraphQLFieldMap, isObjectType } from "graphql";
import { describe, expect, it } from "vitest";
import { graphqlTypeDefs } from "@/lib/graphql/schema";

const contractsDirectory = fileURLToPath(
  new URL("../../docs/contracts/", import.meta.url),
);

type GraphqlFieldContract = {
  arguments?: Record<string, string>;
  name: string;
  parent?: string;
  returns: string;
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
  expectedParent: "Query" | "Mutation" | "Viewer",
) {
  const map = new Map<string, GraphqlFieldShape>();
  for (const field of fields) {
    const validParent =
      expectedParent === "Viewer"
        ? field.parent === "Viewer"
        : field.parent === undefined || field.parent === expectedParent;
    if (!validParent) {
      throw new Error(
        `GraphQL contract field ${field.name} has parent ${field.parent ?? "(omitted)"}; expected ${expectedParent}`,
      );
    }
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
  it("keeps stable root and Viewer field signatures aligned", async () => {
    const schema = buildSchema(graphqlTypeDefs);
    const [queryContracts, mutationContracts, viewerContracts] =
      await Promise.all([
        collectContractFields("queries"),
        collectContractFields("mutations"),
        collectContractFields("fields"),
      ]);
    const viewerType = schema.getType("Viewer");

    expect(contractFieldMap(queryContracts, "Query")).toEqual(
      schemaFieldMap(schema.getQueryType()?.getFields()),
    );
    expect(contractFieldMap(mutationContracts, "Mutation")).toEqual(
      schemaFieldMap(schema.getMutationType()?.getFields()),
    );
    expect(isObjectType(viewerType)).toBe(true);
    expect(contractFieldMap(viewerContracts, "Viewer")).toEqual(
      schemaFieldMap(isObjectType(viewerType) ? viewerType.getFields() : {}),
    );
  });
});
