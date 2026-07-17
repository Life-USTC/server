import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildSchema, type GraphQLFieldMap } from "graphql";
import { describe, expect, it } from "vitest";
import { graphqlTypeDefs } from "@/lib/graphql/schema";

const contractsDirectory = fileURLToPath(
  new URL("../../docs/contracts/", import.meta.url),
);

type GraphqlFieldContract = {
  name: string;
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
          };
    }
  >;
};

async function collectContractFields(kind: "queries" | "mutations") {
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

function contractFieldMap(fields: GraphqlFieldContract[]) {
  const map = new Map<string, string>();
  for (const field of fields) {
    if (map.has(field.name)) {
      throw new Error(`Duplicate GraphQL contract field: ${field.name}`);
    }
    map.set(field.name, field.returns);
  }
  return Object.fromEntries(
    [...map].sort(([left], [right]) => left.localeCompare(right)),
  );
}

function schemaFieldMap(fields: GraphQLFieldMap<unknown, unknown> | undefined) {
  return Object.fromEntries(
    Object.entries(fields ?? {})
      .map(([name, field]) => [name, String(field.type)])
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

describe("GraphQL contract and SDL parity", () => {
  it("keeps every stable Query and Mutation name and return type aligned", async () => {
    const schema = buildSchema(graphqlTypeDefs);
    const [queryContracts, mutationContracts] = await Promise.all([
      collectContractFields("queries"),
      collectContractFields("mutations"),
    ]);

    expect(contractFieldMap(queryContracts)).toEqual(
      schemaFieldMap(schema.getQueryType()?.getFields()),
    );
    expect(contractFieldMap(mutationContracts)).toEqual(
      schemaFieldMap(schema.getMutationType()?.getFields()),
    );
  });
});
