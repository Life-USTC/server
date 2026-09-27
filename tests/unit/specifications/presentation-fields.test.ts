import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  getMcpToolOutputSchemaForMode,
  hasMcpToolOutputSchema,
} from "@/lib/mcp/tool-output-schemas";
import {
  readSpecifications,
  type SpecificationFile,
} from "../../../scripts/specifications/repository";
import {
  loadSpecificationValidators,
  validateSpecificationShapes,
} from "../../../scripts/specifications/validate";

const validators = await loadSpecificationValidators();
const files = await readSpecifications();
const course = files.find(({ data }) => data.id === "course");
if (!course) throw new Error("Course specification is required");
function specimen(presentation: unknown): SpecificationFile {
  const copy = structuredClone(course) as SpecificationFile & {
    data: { capabilities: Record<string, Record<string, unknown>> };
  };
  copy.data.capabilities["course-list"].presentation = presentation;
  return copy;
}
const fields = {
  kind: "fields",
  views: {
    web: {
      primary: ["course.namePrimary"],
      secondary: ["course.code"],
      tertiary: ["course.id"],
    },
  },
};

type SchemaNode = {
  $ref?: string;
  type?: string;
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;
  anyOf?: SchemaNode[];
  oneOf?: SchemaNode[];
};
function schemaContains(
  node: SchemaNode,
  path: string[],
  root: SchemaNode,
): boolean {
  if (node.$ref) {
    const target = node.$ref
      .replace(/^#\//, "")
      .split("/")
      .reduce<unknown>(
        (value, key) =>
          value && typeof value === "object"
            ? (value as Record<string, unknown>)[key]
            : undefined,
        root,
      );
    return Boolean(target && schemaContains(target as SchemaNode, path, root));
  }
  if (path.length === 0) return true;
  const union = node.anyOf ?? node.oneOf;
  if (union) return union.some((child) => schemaContains(child, path, root));
  if (node.type === "array" && node.items)
    return schemaContains(node.items, path, root);
  const child = node.properties?.[path[0]];
  return Boolean(child && schemaContains(child, path.slice(1), root));
}

describe("Structured presentation declarations", () => {
  it("ui.model-property-priority-1", () => {
    expect(validateSpecificationShapes(files, validators)).toEqual([]);
    const declarations = files.flatMap(({ data }) =>
      Object.values(
        (data.capabilities ?? {}) as Record<
          string,
          { presentation?: Record<string, unknown> }
        >,
      ).flatMap(({ presentation }) => (presentation ? [presentation] : [])),
    );
    // MCP property paths refer to the actual registered tool's default/full schema,
    // rather than assuming that Web namePrimary fields are wire fields.
    for (const { data } of files) {
      const capabilities = (data.capabilities ?? {}) as Record<
        string,
        {
          presentation?: {
            kind: string;
            views?: Record<string, Record<string, string[]>>;
          };
          mcp?: { tools?: Array<{ name: string }> };
        }
      >;
      for (const capability of Object.values(capabilities)) {
        if (capability.presentation?.kind !== "fields") continue;
        for (const tool of capability.mcp?.tools ?? []) {
          const view =
            capability.presentation.views?.[
              `mcp-${tool.name.replaceAll("_", "-")}`
            ];
          expect(view, tool.name).toBeDefined();
          expect(hasMcpToolOutputSchema(tool.name), tool.name).toBe(true);
          if (!view) throw new Error(`Missing field view for ${tool.name}`);
          for (const [group, paths] of Object.entries(view)) {
            const schema = z.toJSONSchema(
              getMcpToolOutputSchemaForMode(
                tool.name,
                group === "tertiary" ? "full" : "default",
              ),
            ) as SchemaNode;
            for (const path of paths)
              expect(
                schemaContains(schema, path.split("."), schema),
                `${tool.name}.${path}`,
              ).toBe(true);
          }
        }
      }
    }
    expect(declarations.length).toBeGreaterThan(0);
    expect(new Set(declarations.map(({ kind }) => kind))).toEqual(
      new Set(["fields", "interaction", "protocol", "unavailable"]),
    );
    expect(validateSpecificationShapes([specimen(fields)], validators)).toEqual(
      [],
    );
    const invalid = [
      { items: ["course name"] },
      { kind: "fields" },
      { kind: "fields", views: {} },
      { kind: "fields", views: { web: { primary: [] } } },
      {
        kind: "fields",
        views: {
          web: {
            primary: ["Name (leading title)"],
            secondary: [],
            tertiary: [],
          },
        },
      },
      {
        kind: "fields",
        views: {
          web: {
            primary: ["course.namePrimary", "course.namePrimary"],
            secondary: [],
            tertiary: [],
          },
        },
      },
      {
        kind: "fields",
        views: {
          web: {
            primary: ["course.namePrimary"],
            secondary: ["course.namePrimary"],
            tertiary: [],
          },
        },
      },
      { ...fields, kind: "interaction", items: ["Open the dialog"] },
      { ...fields, views: { "invented-runtime": fields.views.web } },
    ];
    for (const value of invalid)
      expect(
        validateSpecificationShapes([specimen(value)], validators),
        JSON.stringify(value),
      ).not.toEqual([]);
  });
});
