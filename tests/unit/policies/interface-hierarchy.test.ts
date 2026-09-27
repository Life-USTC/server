import { createRequire } from "node:module";
import type { GraphQLObjectType } from "graphql";
import { expect, test } from "vitest";
import { graphqlPersistedOperationRegistry } from "@/lib/graphql/operations";
import { graphqlSchema } from "@/lib/graphql/schema";
import { readSpecification } from "../../../scripts/specifications/yaml";

const { getNamedType, isObjectType, Kind } = createRequire(import.meta.url)(
  "graphql",
) as typeof import("graphql");

test("interface-hierarchy.surface-mapping-1", async () => {
  const { scopes } = await readSpecification<{ scopes: Array<{ id: string }> }>(
    "docs/policies/interface-hierarchy.yaml",
  );
  const query = graphqlSchema.getQueryType();
  if (!query) throw new Error("Missing executable Query");
  const fields = query.getFields();
  expect(Object.keys(fields).sort()).toEqual(
    scopes
      .map(({ id }) => id)
      .filter((id) => id !== "admin")
      .sort(),
  );
  for (const field of Object.values(fields)) {
    const scope = getNamedType(field.type);
    expect(isObjectType(scope), field.name).toBe(true);
    if (!isObjectType(scope))
      throw new Error(`Missing scope object ${field.name}`);
    expect(Object.keys(scope.getFields()).length).toBeGreaterThan(0);
    expect(
      Object.keys(scope.getFields()).every((name) => !name.includes("_")),
    ).toBe(true);
  }
});

test("interface-hierarchy.surface-mapping-2", () => {
  const mutation = graphqlSchema.getMutationType();
  const query = graphqlSchema.getQueryType();
  if (!mutation || !query)
    throw new Error("Missing executable operation roots");
  const fields = mutation.getFields();
  const operations = graphqlPersistedOperationRegistry.filter(
    (operation) => operation.operationType === "mutation",
  );
  expect(operations.length).toBeGreaterThan(0);
  expect(operations.map((operation) => operation.rootField).sort()).toEqual(
    Object.keys(fields).sort(),
  );
  for (const operation of operations) {
    const definition = operation.document.definitions.find(
      (definition) => definition.kind === Kind.OPERATION_DEFINITION,
    );
    if (!definition || definition.kind !== Kind.OPERATION_DEFINITION)
      throw new Error(`Missing operation ${operation.id}`);
    expect(definition.operation).toBe("mutation");
    const selections = definition.selectionSet.selections;
    expect(selections).toHaveLength(1);
    const selection = selections[0];
    expect(selection.kind).toBe(Kind.FIELD);
    if (selection.kind !== Kind.FIELD)
      throw new Error(`Missing root field ${operation.id}`);
    expect(selection.name.value).toBe(operation.rootField);
    expect(fields[operation.rootField]).toBeDefined();
  }
  const seen = new Set<string>();
  function verifyQueryType(type: GraphQLObjectType) {
    if (seen.has(type.name)) return;
    seen.add(type.name);
    expect(type.name).not.toBe(mutation?.name);
    for (const [name, field] of Object.entries(type.getFields())) {
      expect(Object.hasOwn(fields, name), `${type.name}.${name}`).toBe(false);
      const child = getNamedType(field.type);
      if (isObjectType(child)) verifyQueryType(child);
    }
  }
  verifyQueryType(query);
});
