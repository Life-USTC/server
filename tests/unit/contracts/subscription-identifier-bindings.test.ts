import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { expect, it } from "vitest";
import { graphqlSchema } from "@/lib/graphql/schema";
import { createMcpServer } from "@/lib/mcp/server";
import {
  loadSpecificationValidators,
  validateSpecificationShapes,
} from "../../../scripts/specifications/validate";
import { readSpecification } from "../../../scripts/specifications/yaml";

const { getNamedType, isInputObjectType } = createRequire(import.meta.url)(
  "graphql",
) as typeof import("graphql");
type Entry = {
  name: string;
  path: string;
  method?: string;
  identifier_inputs?: Record<string, string>;
};
type Spec = {
  capabilities: Record<
    string,
    {
      rest?: { routes: Entry[] };
      graphql?: { mutations: Entry[] };
      mcp?: { tools: Entry[] };
    }
  >;
};
type Schema = {
  $ref?: string;
  type?: string;
  properties?: Record<string, Schema>;
  items?: Schema;
  anyOf?: Schema[];
};

it("interface-hierarchy.semantic-parity-13", async () => {
  const spec = await readSpecification<Spec>("docs/features/subscription.yaml");
  const openapi = JSON.parse(
    await readFile("public/openapi.generated.json", "utf8"),
  );
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "identifier-contract", version: "1" });
  const server = createMcpServer();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const resolve = (schema: Schema): Schema =>
    schema.$ref
      ? schema.$ref
          .slice(2)
          .split("/")
          .reduce((value, key) => value[key], openapi)
      : schema;
  const numeric = (schema: Schema): boolean => {
    const resolved = resolve(schema);
    return (
      resolved.type === "integer" ||
      resolved.type === "number" ||
      (resolved.type === "array" &&
        !!resolved.items &&
        numeric(resolved.items)) ||
      !!resolved.anyOf?.some(numeric)
    );
  };
  const observations: Record<string, Record<string, string>> = {};
  try {
    const tools = (await client.listTools()).tools;
    for (const cap of Object.values(spec.capabilities)) {
      for (const entry of cap.rest?.routes ?? []) {
        const operation =
          openapi.paths[entry.path]?.[(entry.method ?? "GET").toLowerCase()];
        expect(operation, entry.path).toBeDefined();
        const body =
          operation.requestBody?.content?.["application/json"]?.schema;
        const properties: Record<string, Schema> = {
          ...(body ? resolve(body).properties : {}),
        };
        for (const parameter of operation.parameters ?? [])
          properties[parameter.name] = parameter.schema;
        const identifiers = Object.entries(properties).filter(
          ([name, schema]) => /(?:Id|Ids)$/.test(name) && numeric(schema),
        );
        expect(
          Object.keys(entry.identifier_inputs ?? {}).sort(),
          entry.path,
        ).toEqual(identifiers.map(([name]) => name).sort());
        if (identifiers.length)
          observations[`${entry.method ?? "GET"} ${entry.path}`] =
            entry.identifier_inputs!;
      }
      for (const entry of cap.graphql?.mutations ?? []) {
        const field = graphqlSchema.getMutationType()?.getFields()[entry.name];
        expect(field, entry.name).toBeDefined();
        const names = field!.args.flatMap((argument) => {
          const named = getNamedType(argument.type);
          if (isInputObjectType(named))
            return Object.values(named.getFields())
              .filter(
                (input) =>
                  getNamedType(input.type).name === "Int" &&
                  input.name.endsWith("Id"),
              )
              .map((input) => `${argument.name}.${input.name}`);
          return named.name === "Int" && argument.name.endsWith("Id")
            ? [argument.name]
            : [];
        });
        expect(
          Object.keys(entry.identifier_inputs ?? {}).sort(),
          entry.name,
        ).toEqual(names.sort());
        if (names.length) observations[entry.name] = entry.identifier_inputs!;
      }
      for (const entry of cap.mcp?.tools ?? []) {
        const tool = tools.find((tool) => tool.name === entry.name);
        expect(tool, entry.name).toBeDefined();
        const names = Object.entries(tool!.inputSchema.properties ?? {})
          .filter(
            ([name, schema]) =>
              /(?:Id|Ids)$/.test(name) && numeric(schema as Schema),
          )
          .map(([name]) => name);
        expect(
          Object.keys(entry.identifier_inputs ?? {}).sort(),
          entry.name,
        ).toEqual(names.sort());
        if (names.length) observations[entry.name] = entry.identifier_inputs!;
      }
    }
    expect(observations).toEqual({
      "POST /api/workspace/subscriptions/query": {
        sectionIds: "Section.id",
        semesterId: "Semester.id",
      },
      "POST /api/workspace/subscriptions/batch": {
        sectionIds: "Section.id",
        semesterId: "Semester.id",
      },
      "POST /api/catalog/sections/match-codes": { semesterId: "Semester.id" },
      "PATCH /api/workspace/subscriptions": { sectionIds: "Section.id" },
      "DELETE /api/workspace/subscriptions": { sectionIds: "Section.id" },
      "PATCH /api/workspace/subscriptions/{jwId}": { jwId: "Section.jwId" },
      subscriptionAdd: { jwId: "Section.jwId" },
      subscriptionRemove: { jwId: "Section.jwId" },
      subscriptionKindUpdate: { jwId: "Section.jwId" },
      subscriptionsImport: { "input.semesterId": "Semester.id" },
      workspace_subscription_add: { jwId: "Section.jwId" },
      workspace_subscription_remove: { jwId: "Section.jwId" },
      workspace_subscription_kind_update: { jwId: "Section.jwId" },
      catalog_section_match_preview: { semesterId: "Semester.id" },
      workspace_subscription_import: { semesterId: "Semester.id" },
    });
  } finally {
    await client.close();
    await server.close();
  }
});

it("rejects ambiguous or malformed identifier metadata", async () => {
  const validators = await loadSpecificationValidators();
  const data = await readSpecification<Spec>("docs/features/subscription.yaml");
  const entry = data.capabilities["update-kind"].rest!.routes[0];
  const invalid: Record<string, string>[] = [
    { jwId: "id" },
    { jwId: "Section.code" },
    { "invalid-path": "Section.id" },
    {},
  ];
  for (const identifier_inputs of invalid) {
    entry.identifier_inputs = identifier_inputs;
    expect(
      validateSpecificationShapes(
        [
          {
            path: "docs/features/subscription.yaml",
            data: data as unknown as Record<string, unknown>,
          },
        ],
        validators,
      ),
    ).not.toEqual([]);
  }
});
