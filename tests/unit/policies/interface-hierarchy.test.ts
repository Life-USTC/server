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

test("interface-hierarchy.canonical-tree-2", async () => {
  const { readdir } = await import("node:fs/promises");
  const { getExplicitMcpToolScopeNames } = await import(
    "@/lib/mcp/tool-scopes"
  );
  const forbidden = new Set(["me", "viewer", "my", "own", "dashboard"]);
  const routes = (await readdir("src/routes", { recursive: true })).filter(
    (path) => /\/(\+page|\+server)\.(svelte|ts)$/.test(path),
  );
  expect(routes.length).toBeGreaterThan(50);
  for (const route of routes) {
    if (route.startsWith("_internal/")) continue;
    for (const segment of route.split("/").slice(0, -1)) {
      if (segment.startsWith("[") || segment.startsWith("(")) continue;
      expect(forbidden.has(segment), route).toBe(false);
    }
  }
  for (const name of getExplicitMcpToolScopeNames()) {
    expect(
      name.split("_").filter((part) => forbidden.has(part)),
      name,
    ).toEqual([]);
  }
  for (const operation of graphqlPersistedOperationRegistry) {
    expect(
      operation.id.split(".").filter((part) => forbidden.has(part)),
      operation.id,
    ).toEqual([]);
  }
  const query = graphqlSchema.getQueryType();
  if (!query) throw new Error("Missing Query");
  for (const field of Object.values(query.getFields())) {
    const scope = getNamedType(field.type);
    if (!isObjectType(scope)) throw new Error("Missing scope object");
    expect(
      Object.keys(scope.getFields()).filter((name) => forbidden.has(name)),
    ).toEqual([]);
  }
  expect(
    Object.keys(graphqlSchema.getMutationType()?.getFields() ?? {}).filter(
      (name) => forbidden.has(name),
    ),
  ).toEqual([]);
});

test("interface-hierarchy.surface-mapping-3", async () => {
  const { getExplicitMcpToolScopeNames } = await import(
    "@/lib/mcp/tool-scopes"
  );
  const tools = new Set(getExplicitMcpToolScopeNames());
  const specification = await readSpecification<{
    capabilities: Array<{
      id: string;
      graphql: { status: string; field?: string };
      mcp: { status: string; tools?: string[] };
    }>;
  }>("docs/reference/mutation-capabilities.yaml");
  expect(specification.capabilities.length).toBeGreaterThan(20);
  for (const capability of specification.capabilities) {
    expect(capability.id).toMatch(/^(workspace|community)_[a-z0-9_]+$/);
    if (capability.graphql.status === "stable") {
      const operation = graphqlPersistedOperationRegistry.find(
        (item) =>
          item.operationType === "mutation" &&
          item.rootField === capability.graphql.field,
      );
      expect(operation, capability.id).toBeDefined();
      expect(operation?.id.split(".")[0], capability.id).toBe(
        capability.id.split("_")[0],
      );
    }
    for (const tool of capability.mcp.tools ?? []) {
      if (tool === "graphql_operation_run") {
        expect(capability.graphql.status).toBe("stable");
        continue;
      }
      expect(tools.has(tool), tool).toBe(true);
      expect(tool.split("_")[0], tool).toBe(capability.id.split("_")[0]);
    }
  }
});

test("interface-hierarchy.canonical-actions-1", async () => {
  const { getExplicitMcpToolScopeNames } = await import(
    "@/lib/mcp/tool-scopes"
  );
  for (const tool of getExplicitMcpToolScopeNames()) {
    expect(tool, tool).not.toMatch(/_(view|query|by_id)$/);
  }
  for (const operation of graphqlPersistedOperationRegistry) {
    expect(operation.id, operation.id).not.toMatch(
      /\.(view|query|by_id)\.v\d+$/,
    );
  }
});

test("interface-hierarchy.canonical-actions-3", async () => {
  const specification = await readSpecification<{
    capabilities: Array<{
      id: string;
      semantics: string;
      graphql: { field?: string };
      mcp: { status: string; tools?: string[] };
    }>;
  }>("docs/reference/mutation-capabilities.yaml");
  const cases = [
    ["workspace_todo_delete", "single", "todoDelete"],
    ["workspace_todos_delete", "per_item_partial", "todosDelete"],
    ["community_comment_delete", "single_audited", "commentDelete"],
    ["community_comments_delete", "per_item_partial", "commentsDelete"],
  ];
  for (const [id, semantics, field] of cases) {
    const capability = specification.capabilities.find(
      (item) => item.id === id,
    );
    expect(capability, id).toMatchObject({ semantics, graphql: { field } });
    const operation = graphqlPersistedOperationRegistry.find(
      (item) => item.rootField === field,
    );
    expect(operation, id).toBeDefined();
    const listVariables = operation?.variables.filter((variable) =>
      variable.type.includes("["),
    );
    if (semantics?.startsWith("single"))
      expect(listVariables, id).toHaveLength(0);
    else {
      expect(listVariables?.length, id).toBeGreaterThan(0);
      // Native single-item tools cannot claim the batch result's atomicity.
      expect(capability?.mcp.status).toBe(
        id === "community_comments_delete"
          ? "registered_operation"
          : "single_item_only",
      );
    }
  }
});

test("interface-hierarchy.semantic-parity-9", async () => {
  const { REST_FEATURES } = await import("@/lib/oauth/constants");
  const { OAUTH_SCOPES } = await import("@/lib/oauth/scope-registry");
  const { getExplicitMcpToolScopeNames, getRequiredMcpScopes } = await import(
    "@/lib/mcp/tool-scopes"
  );
  const featureScopes = OAUTH_SCOPES.filter((scope) => scope.includes(":"));
  expect(featureScopes.length).toBeGreaterThan(20);
  for (const scope of featureScopes) {
    const [feature, action] = scope.split(":");
    expect(REST_FEATURES).toContain(feature);
    expect(["read", "write"]).toContain(action);
    // Admin is a provider-reserved scope, never a user business feature.
    if (feature !== "admin")
      expect(feature).toMatch(
        /^(catalog|workspace|community|account)\.[a-z][a-z-]+$/,
      );
  }
  for (const operation of graphqlPersistedOperationRegistry) {
    for (const scope of operation.scopes) {
      expect(featureScopes, operation.id).toContain(scope);
      expect(scope, operation.id).not.toMatch(/^admin:/);
    }
  }
  for (const tool of getExplicitMcpToolScopeNames()) {
    for (const scope of getRequiredMcpScopes(tool)) {
      expect(featureScopes, tool).toContain(scope);
      expect(scope, tool).not.toMatch(/^admin:/);
    }
  }
});
