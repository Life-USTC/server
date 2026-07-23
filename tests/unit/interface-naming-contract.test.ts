import { existsSync, readFileSync } from "node:fs";
import { buildSchema } from "graphql";
import { describe, expect, it } from "vitest";
import { graphqlPersistedOperationRegistry } from "@/lib/graphql/operations";
import { graphqlTypeDefs } from "@/lib/graphql/schema";
import { getExplicitMcpToolScopeNames } from "@/lib/mcp/tool-scopes";

const scopes = ["account", "catalog", "community", "workspace"] as const;
const capabilityName = new RegExp(`^(${scopes.join("|")})_[a-z0-9_]+$`);
const graphqlInfrastructureTools = new Set(["graphql_operation_run"]);
const restInfrastructureRoots = new Set(["auth", "health", "mcp", "openapi"]);

describe("cross-surface interface naming", () => {
  it("uses the canonical scope prefix for every business MCP tool", () => {
    const invalidNames = getExplicitMcpToolScopeNames().filter(
      (name) =>
        !graphqlInfrastructureTools.has(name) && !capabilityName.test(name),
    );

    expect(invalidNames).toEqual([]);
  });

  it("uses the canonical GraphQL query scopes", () => {
    const schema = buildSchema(graphqlTypeDefs);
    const fields = Object.keys(schema.getQueryType()?.getFields() ?? {}).sort();

    expect(fields).toEqual([...scopes].sort());
  });

  it("uses a canonical scope for every business REST route", () => {
    const document = JSON.parse(
      readFileSync("public/openapi.generated.json", "utf8"),
    ) as { paths: Record<string, unknown> };
    const businessRoots = Object.keys(document.paths)
      .filter((path) => path.startsWith("/api/"))
      .map((path) => path.split("/")[2])
      .filter(
        (root): root is string =>
          root != null && !restInfrastructureRoots.has(root),
      );

    expect(new Set(businessRoots)).toEqual(
      new Set([
        "account",
        "admin",
        "calendar-feeds",
        "catalog",
        "community",
        "workspace",
      ]),
    );
  });

  it("does not retain legacy unscoped web entry points", () => {
    const legacyRoots = [
      "bus",
      "bus-map",
      "comments",
      "courses",
      "dashboard",
      "links",
      "sections",
      "settings",
      "signin",
      "signout",
      "teachers",
      "u",
      "welcome",
    ];

    expect(
      legacyRoots.filter((root) => existsSync(`src/routes/${root}`)),
    ).toEqual([]);
  });

  it("keeps GraphQL mutations domain-first and root-level", () => {
    const schema = buildSchema(graphqlTypeDefs);
    const fields = Object.keys(schema.getMutationType()?.getFields() ?? {});
    const verbFirst =
      /^(add|create|delete|remove|rename|save|set|subscribe|unsubscribe|update|upsert)[A-Z]/;

    expect(fields).not.toEqual([]);
    expect(fields.filter((field) => verbFirst.test(field))).toEqual([]);
  });

  it("uses hierarchical scope-domain-action GraphQL operation IDs", () => {
    const operationId =
      /^(account|catalog|community|workspace)(\.[a-z0-9_]+)+\.v1$/;

    expect(
      graphqlPersistedOperationRegistry
        .map((operation) => operation.id)
        .filter((id) => !operationId.test(id)),
    ).toEqual([]);
  });
});
