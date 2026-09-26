import { buildSchema, isObjectType } from "graphql";
import { describe, expect, it } from "vitest";
import { publicGraphqlOperationsManifest } from "@/lib/graphql/operations";
import { graphqlTypeDefs } from "@/lib/graphql/schema";
import {
  getRequiredMcpScopes,
  hasExplicitMcpToolScopes,
} from "@/lib/mcp/tool-scopes";
import { OAUTH_SCOPES } from "@/lib/oauth/scope-registry";
import { readFeatureSpecifications } from "../../../../scripts/specifications/repository";
import { readSpecification } from "../../../../scripts/specifications/yaml";

type GraphqlFieldSpecification = {
  name: string;
  parent?: string;
  auth?: string;
  notes?: string[];
  required_scopes?: string[];
  mcp_equivalent?: string;
  status?: "stable" | "planned" | "unavailable";
};

type FeatureSpecification = {
  id: string;
  capabilities: Record<
    string,
    {
      graphql?:
        | string
        | {
            queries?: GraphqlFieldSpecification[];
            mutations?: GraphqlFieldSpecification[];
            fields?: GraphqlFieldSpecification[];
          };
    }
  >;
};

async function collectSpecificationFields() {
  const features = await readFeatureSpecifications<FeatureSpecification>();
  return features.flatMap((feature) =>
    Object.entries(feature.capabilities).flatMap(
      ([capabilityId, capability]) => {
        const graphql = capability.graphql;
        if (typeof graphql !== "object" || graphql == null) return [];
        return (["queries", "mutations", "fields"] as const).flatMap((kind) =>
          (graphql[kind] ?? [])
            .filter(
              (field) =>
                field.status !== "planned" && field.status !== "unavailable",
            )
            .map((field) => ({
              ...field,
              parent:
                field.parent ?? (kind === "mutations" ? "Mutation" : "Query"),
              source: `${feature.id}.${capabilityId}`,
            })),
        );
      },
    ),
  );
}

describe("GraphQL product specification and executable schema parity", () => {
  it("only advertises scoped query fields that exist in the executable schema", async () => {
    const specification = await readSpecification<{
      capabilities: Record<string, { presentation: { items: string[] } }>;
    }>("docs/features/graphql.yaml");
    const schema = buildSchema(graphqlTypeDefs);
    const paths =
      specification.capabilities["scoped-queries"].presentation.items;
    for (const path of paths.flatMap((entry) => entry.split(" / "))) {
      const [scope, name] = path.split(".");
      const type = schema.getQueryType()?.getFields()[scope]?.type;
      const scopedType = type && schema.getType(String(type).replace(/!$/, ""));
      expect(isObjectType(scopedType), path).toBe(true);
      expect(
        isObjectType(scopedType) && scopedType.getFields()[name],
        path,
      ).toBeTruthy();
    }
  });

  it("documents valid OAuth scopes matching native MCP equivalents", async () => {
    const fields = await collectSpecificationFields();
    expect(
      fields.filter((field) => field.required_scopes).length,
    ).toBeGreaterThan(0);
    for (const field of fields) {
      const scopes = field.required_scopes ?? [];
      for (const scope of scopes) {
        expect(
          OAUTH_SCOPES,
          `${field.name}: unsupported scope ${scope}`,
        ).toContain(scope);
      }
      const tool = field.mcp_equivalent;
      if (tool) {
        expect(
          hasExplicitMcpToolScopes(tool),
          `${field.name}: unknown MCP tool ${tool}`,
        ).toBe(true);
        // The GraphQL runner resolves scopes per operation. A public GraphQL
        // read may have a stricter native MCP boundary; explicit scope
        // declarations must still match, including an explicit empty list.
        if (tool !== "graphql_operation_run" && field.required_scopes) {
          expect([...scopes].sort(), field.name).toEqual(
            getRequiredMcpScopes(tool).sort(),
          );
        }
      }
    }
  });

  it("documents anonymous Community.user reads and the stricter native MCP scope", async () => {
    const fields = await collectSpecificationFields();
    const user = fields.find(
      (field) => field.parent === "Community" && field.name === "user",
    );
    expect(user).toMatchObject({
      auth: "anon",
      mcp_equivalent: "community_user_get",
    });
    expect(user?.required_scopes ?? []).toEqual([]);
    expect(user?.notes?.join(" ")).toMatch(/anonymous/i);
    expect(user?.notes?.join(" ")).toContain("community.user:read");
    expect(getRequiredMcpScopes("community_user_get")).toEqual([
      "community.user:read",
    ]);
    expect(
      publicGraphqlOperationsManifest.operations.find(
        (operation) => operation.id === "community.user.get.v1",
      )?.scopes,
    ).toEqual([]);
  });

  it("declares every stable root and scoped field exactly once", async () => {
    const schema = buildSchema(graphqlTypeDefs);
    const fields = await collectSpecificationFields();
    const declaredPaths = fields.map(
      (field) => `${field.parent}.${field.name}`,
    );
    expect(new Set(declaredPaths).size).toBe(declaredPaths.length);
    for (const field of fields) {
      const parent = schema.getType(field.parent);
      const path = `${field.source}: ${field.parent}.${field.name}`;
      expect(isObjectType(parent), path).toBe(true);
      expect(
        isObjectType(parent) && parent.getFields()[field.name],
        path,
      ).toBeTruthy();
    }
    // SDL snapshot tests own argument and return signatures. Product YAML owns
    // the complete exposed capability set and its authorization relationships.
    for (const parentName of [
      "Query",
      "Mutation",
      "Catalog",
      "Workspace",
      "Community",
      "Account",
    ]) {
      const parent = schema.getType(parentName);
      expect(isObjectType(parent), parentName).toBe(true);
      expect(
        fields
          .filter((field) => field.parent === parentName)
          .map((field) => field.name)
          .sort(),
        parentName,
      ).toEqual(
        Object.keys(isObjectType(parent) ? parent.getFields() : {}).sort(),
      );
    }
  });
});
