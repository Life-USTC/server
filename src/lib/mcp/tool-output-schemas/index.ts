import { z } from "zod";
import {
  accountClientActivityResponseSchema,
  meResponseSchema,
} from "@/lib/api/schemas/misc-response-schema-core";
import { busModeOutputSchemas, busToolOutputSchemas } from "./bus";
import {
  type CatalogAcademicModeToolName,
  catalogAcademicModeOutputSchemas,
  catalogNonAcademicModeOutputSchemas,
  catalogToolOutputSchemas,
} from "./catalog";
import {
  communityModeOutputSchemas,
  communityToolOutputSchemas,
  MARKDOWN_MODE_OUTPUT_SCHEMAS,
} from "./community";
import {
  type McpToolOutputSchema,
  objectOutputSchema,
  objectOutputSchemaFromApi,
  STRUCTURED_CONTENT_OUTPUT_SCHEMA,
} from "./shared";
import {
  type WorkspaceAcademicModeToolName,
  workspaceAcademicModeOutputSchemas,
  workspaceNonAcademicModeOutputSchemas,
  workspaceToolOutputSchemas,
} from "./workspace";

export type { McpToolOutputSchema } from "./shared";
export { STRUCTURED_CONTENT_OUTPUT_SCHEMA } from "./shared";

const academicModeOutputSchemas = {
  ...catalogAcademicModeOutputSchemas,
  ...workspaceAcademicModeOutputSchemas,
} satisfies Record<string, Record<"default" | "full", McpToolOutputSchema>>;

type AcademicModeToolName = keyof typeof academicModeOutputSchemas;

const nonAcademicModeOutputSchemas = {
  ...communityModeOutputSchemas,
  ...workspaceNonAcademicModeOutputSchemas,
  ...catalogNonAcademicModeOutputSchemas,
  ...busModeOutputSchemas,
} satisfies Record<string, Record<"default" | "full", McpToolOutputSchema>>;

type NonAcademicModeToolName = keyof typeof nonAcademicModeOutputSchemas;

// Production startup asserts that every registered application tool has an
// explicit entry. The fallback exists only for isolated SDK/test registrations.
const TOOL_OUTPUT_SCHEMAS: Record<string, McpToolOutputSchema> = {
  graphql_operation_run: objectOutputSchema({
    operationId: z.string(),
    operationName: z.string(),
    operationType: z.enum(["mutation", "query"]),
    data: z.record(z.string(), z.unknown()).nullable(),
    errors: z.array(
      z
        .object({
          message: z.string(),
          locations: z
            .array(
              z.object({
                line: z.number().int().positive(),
                column: z.number().int().positive(),
              }),
            )
            .optional(),
          path: z.array(z.union([z.string(), z.number().int()])).optional(),
          extensions: z.record(z.string(), z.unknown()).optional(),
        })
        .strict(),
    ),
    requiredScopes: z.array(z.string()),
  }),
  account_profile_get: objectOutputSchemaFromApi(meResponseSchema),
  account_client_activity_list: objectOutputSchemaFromApi(
    accountClientActivityResponseSchema,
  ),
  ...communityToolOutputSchemas,
  ...workspaceToolOutputSchemas,
  ...catalogToolOutputSchemas,
  ...busToolOutputSchemas,
};

export function getMcpToolOutputSchema(name: string): McpToolOutputSchema {
  return TOOL_OUTPUT_SCHEMAS[name] ?? STRUCTURED_CONTENT_OUTPUT_SCHEMA;
}

export function getMcpToolOutputSchemaForMode(
  name: string,
  mode: "default" | "full",
): McpToolOutputSchema {
  if (Object.hasOwn(academicModeOutputSchemas, name)) {
    return academicModeOutputSchemas[name as AcademicModeToolName][mode];
  }
  if (Object.hasOwn(nonAcademicModeOutputSchemas, name)) {
    return nonAcademicModeOutputSchemas[name as NonAcademicModeToolName][mode];
  }
  return getMcpToolOutputSchema(name);
}

export function getMarkdownMcpToolOutputSchemaForMode(
  name: keyof typeof MARKDOWN_MODE_OUTPUT_SCHEMAS,
  mode: "default" | "full",
): McpToolOutputSchema {
  return MARKDOWN_MODE_OUTPUT_SCHEMAS[name][mode];
}

export function hasMcpToolOutputSchema(name: string): boolean {
  return Object.hasOwn(TOOL_OUTPUT_SCHEMAS, name);
}

export function getMcpToolOutputSchemaNames(): string[] {
  return Object.keys(TOOL_OUTPUT_SCHEMAS);
}

// Silence unused-type warnings for domain-specific name aliases used only via merge.
void 0 as unknown as CatalogAcademicModeToolName;
void 0 as unknown as WorkspaceAcademicModeToolName;
