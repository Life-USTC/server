/**
 * Custom OpenAPI spec generator replacing next-openapi-gen.
 *
 * Reads route files, extracts JSDoc annotations, and generates
 * the pre-postprocessed OpenAPI document consumed by postprocess-spec.ts.
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { z } from "zod";
import * as requestSchemas from "../../../src/lib/api/schemas/request-schemas";
import * as responseSchemas from "../../../src/lib/api/schemas/response-schemas";
import { OPENAPI_SPEC_RELATIVE_PATH } from "../../../src/lib/openapi/spec";

const ROOT = new URL("../../..", import.meta.url).pathname;

type JsonSchema = Record<string, unknown>;

type OpenApiParameter = {
  in: "query" | "path";
  name: string;
  schema: JsonSchema;
  required: boolean;
  example?: string;
};

type OpenApiOperation = {
  operationId: string;
  summary: string;
  description: string;
  tags: string[];
  parameters: OpenApiParameter[];
  requestBody?: unknown;
  responses: Record<string, unknown>;
};

type OpenApiPathItem = Record<string, OpenApiOperation>;

type OpenApiDocument = {
  openapi: string;
  info: unknown;
  servers: unknown[];
  paths: Record<string, OpenApiPathItem>;
  components: { schemas: Record<string, JsonSchema> };
};

const generatorConfigSchema = z.object({
  openapi: z.string().optional(),
  info: z
    .object({
      title: z.string(),
      version: z.string(),
      description: z.string().optional(),
    })
    .optional(),
  servers: z
    .array(
      z.object({
        url: z.string(),
        description: z.string().optional(),
      }),
    )
    .optional(),
});

// ── Schema registry ────────────────────────────────────────────────────────────

const allSchemas: Record<string, z.ZodTypeAny> = {};

for (const [name, value] of Object.entries({
  ...requestSchemas,
  ...responseSchemas,
})) {
  if (value && typeof value === "object" && "_def" in value) {
    allSchemas[name] = value as z.ZodTypeAny;
  }
}

function zodToJsonSchema(name: string, schema: z.ZodTypeAny): JsonSchema {
  try {
    const result = z.toJSONSchema(schema, {
      cycles: "ref",
      unrepresentable: "any",
    }) as JsonSchema;
    const { $schema: _unused, ...rest } = result;
    return rest;
  } catch (error) {
    throw new Error(`Failed to convert OpenAPI schema ${name}`, {
      cause: error,
    });
  }
}

function getSchemaJsonSchema(name: string): JsonSchema {
  const schema = allSchemas[name];
  if (!schema) {
    throw new Error(`OpenAPI annotation references unknown schema: ${name}`);
  }
  return zodToJsonSchema(name, schema);
}

// ── Path parsing ───────────────────────────────────────────────────────────────

function filePathToApiPath(filePath: string): string {
  // filePath is relative to ROOT, e.g. "src/app/api/comments/[id]/route.ts"
  const relative = filePath
    .replace(/^src\/app/, "")
    .replace(/\/route\.ts$/, "");
  // Convert [param] and [...param] to {param}
  return relative
    .replace(/\[\.\.\.([^\]]+)\]/g, "{$1}")
    .replace(/\[([^\]]+)\]/g, "{$1}");
}

// ── JSDoc extraction ───────────────────────────────────────────────────────────

type HandlerAnnotations = {
  summary: string;
  params?: string; // schema name for query params
  pathParams?: string; // schema name for path params
  body?: string; // schema name for request body
  responses: Array<{ status: number | null; schemaName: string | null }>;
};

type RouteExportKind = "function" | "const" | "destructured";

function getRouteExportKind(
  source: string,
  httpMethod: (typeof HTTP_METHODS)[number],
): RouteExportKind | null {
  if (
    new RegExp(`export\\s+(?:async\\s+)?function\\s+${httpMethod}\\b`).test(
      source,
    )
  ) {
    return "function";
  }

  if (new RegExp(`export\\s+const\\s+${httpMethod}\\s*=`).test(source)) {
    return "const";
  }

  if (
    new RegExp(
      `export\\s+const\\s*\\{(?=[^}]*\\b${httpMethod}\\b)[^}]*\\}\\s*=`,
      "s",
    ).test(source)
  ) {
    return "destructured";
  }

  return null;
}

function extractJsDocAnnotations(
  source: string,
  httpMethod: string,
  exportKind: RouteExportKind,
): HandlerAnnotations | null {
  // Find the exported handler function preceded by a JSDoc comment
  const pattern =
    exportKind === "destructured"
      ? new RegExp(
          `/\\*\\*[\\s\\S]*?\\*/\\s*export\\s+const\\s*\\{(?=[^}]*\\b${httpMethod}\\b)[^}]*\\}\\s*=`,
          "g",
        )
      : new RegExp(
          `/\\*\\*[\\s\\S]*?\\*/\\s*export\\s+(?:async\\s+)?function\\s+${httpMethod}\\b`,
          "g",
        );
  const match = pattern.exec(source);
  if (!match) return null;

  const jsdoc = match[0];

  // Extract summary (first non-tag line)
  const summaryMatch = /\/\*\*\s*\n\s*\*\s*([^@\n][^\n]*)/.exec(jsdoc);
  const summary = summaryMatch
    ? `${summaryMatch[1].trim().replace(/\.$/, "")}.`
    : "";

  const annotations: HandlerAnnotations = { summary, responses: [] };

  // @params schemaName (query params)
  const paramsMatch = /@params\s+(\w+)/.exec(jsdoc);
  if (paramsMatch) annotations.params = paramsMatch[1];

  // @pathParams schemaName
  const pathParamsMatch = /@pathParams\s+(\w+)/.exec(jsdoc);
  if (pathParamsMatch) annotations.pathParams = pathParamsMatch[1];

  // @body schemaName
  const bodyMatch = /@body\s+(\w+)/.exec(jsdoc);
  if (bodyMatch) annotations.body = bodyMatch[1];

  // @response schemaName, @response statusCode:schemaName, or @response statusCode (redirect/empty)
  // Pattern: optional digits+colon prefix (status), then either word chars (schema) or end-of-context
  const responsePattern = /@response\s+(?:(\d+)(?::(\w+))?|(\w+))/g;
  let responseMatch = responsePattern.exec(jsdoc);
  while (responseMatch !== null) {
    if (responseMatch[1] !== undefined) {
      // Matched @response STATUS or @response STATUS:SCHEMA
      const status = Number(responseMatch[1]);
      annotations.responses.push({
        status,
        schemaName: responseMatch[2] ?? null,
      });
    } else {
      // Matched @response SCHEMA (no explicit status code)
      annotations.responses.push({
        status: null,
        schemaName: responseMatch[3],
      });
    }
    responseMatch = responsePattern.exec(jsdoc);
  }

  return annotations;
}

function buildDefaultResponses(source: string, method: string) {
  if (
    method === "OPTIONS" &&
    /create(?:OAuthDiscovery|Discovery(?:Metadata|Redirect))Route\(/.test(
      source,
    )
  ) {
    return {
      "204": {
        description: "Response 204",
      },
    };
  }

  return {
    "200": {
      description: "Successful response",
      content: { "application/json": { schema: {} } },
    },
  };
}

// ── Parameter building ─────────────────────────────────────────────────────────

function buildParameters(annotations: HandlerAnnotations): OpenApiParameter[] {
  const params: OpenApiParameter[] = [];

  if (annotations.pathParams) {
    const jsonSchema = getSchemaJsonSchema(annotations.pathParams);
    const properties =
      (jsonSchema.properties as Record<string, JsonSchema>) ?? {};
    const required = (jsonSchema.required as string[]) ?? [];
    for (const [name, propSchema] of Object.entries(properties)) {
      params.push({
        in: "path",
        name,
        schema: normalizeParameterSchema({ type: "string", ...propSchema }),
        required: required.includes(name),
        example: "123",
      });
    }
  }

  if (annotations.params) {
    const jsonSchema = getSchemaJsonSchema(annotations.params);
    const properties =
      (jsonSchema.properties as Record<string, JsonSchema>) ?? {};
    const required = (jsonSchema.required as string[]) ?? [];
    for (const [name, propSchema] of Object.entries(properties)) {
      params.push({
        in: "query",
        name,
        schema: normalizeParameterSchema(propSchema),
        required: required.includes(name),
      });
    }
  }

  return params;
}

function normalizeParameterSchema(schema: JsonSchema): JsonSchema {
  if (schema.openapiType !== "integer") {
    return schema;
  }

  const { openapiType: _unused, ...rest } = schema;
  return { ...rest, type: "integer", format: "int64" };
}

// ── Response building ──────────────────────────────────────────────────────────

function buildResponses(
  annotations: HandlerAnnotations,
  usedSchemas: Set<string>,
): Record<string, unknown> {
  const responses: Record<string, unknown> = {};

  for (const { status, schemaName } of annotations.responses) {
    const code = status ?? 200;

    // Status-only annotation (e.g. @response 302) — redirect or empty body
    if (schemaName === null) {
      const isRedirect = code >= 300 && code < 400;
      responses[String(code)] = isRedirect
        ? {
            description: "Redirect",
            headers: {
              Location: { schema: { type: "string", format: "uri" } },
            },
          }
        : { description: `Response ${code}` };
      continue;
    }

    if (schemaName === "binary") {
      responses[String(code)] = {
        description: "Binary response",
        content: {
          "application/octet-stream": {
            schema: { type: "string", format: "binary" },
          },
        },
      };
      continue;
    }

    if (schemaName === "array") {
      responses[String(code)] = {
        description: "Array response",
        content: {
          "application/json": { schema: { type: "array", items: {} } },
        },
      };
      continue;
    }

    // schemaName is always a non-null string here; null case was handled above
    usedSchemas.add(schemaName as string);
    responses[String(code)] = {
      description: code === 200 ? "Successful response" : "Error response",
      content: {
        "application/json": {
          schema: { $ref: `#/components/schemas/${schemaName}` },
        },
      },
    };
  }

  // Default 200 only when the handler had no explicit @response annotations.
  if (Object.keys(responses).length === 0) {
    responses["200"] = {
      description: "Successful response",
      content: { "application/json": { schema: {} } },
    };
  }

  return responses;
}

// ── Request body building ─────────────────────────────────────────────────────

function buildRequestBody(
  annotations: HandlerAnnotations,
  usedSchemas: Set<string>,
): unknown {
  if (!annotations.body) return undefined;
  usedSchemas.add(annotations.body);
  return {
    content: {
      "application/json": {
        schema: { $ref: `#/components/schemas/${annotations.body}` },
      },
    },
  };
}

// ── Route file processing ─────────────────────────────────────────────────────

const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const;

async function processRouteFile(
  filePath: string,
  usedSchemas: Set<string>,
): Promise<{ apiPath: string; pathItem: OpenApiPathItem } | null> {
  const source = await readFile(path.join(ROOT, filePath), "utf8");
  const apiPath = filePathToApiPath(filePath);

  const pathItem: OpenApiPathItem = {};

  for (const method of HTTP_METHODS) {
    const exportKind = getRouteExportKind(source, method);
    if (!exportKind) {
      continue;
    }

    const annotations =
      exportKind === "function" ||
      (exportKind === "destructured" && method !== "OPTIONS")
        ? extractJsDocAnnotations(source, method, exportKind)
        : null;
    if (!annotations) {
      // Handler exists but no JSDoc - create minimal operation
      const operationId = `${method.toLowerCase()}-${apiPath.replace(/\//g, "-").replace(/[{}]/g, "").replace(/^-/, "")}`;
      pathItem[method.toLowerCase()] = {
        operationId,
        summary: "",
        description: "",
        tags: [],
        parameters: [],
        responses: buildDefaultResponses(source, method),
      };
      continue;
    }

    const operationId = `${method.toLowerCase()}-${apiPath.replace(/\//g, "-").replace(/[{}]/g, "").replace(/^-/, "")}`;
    const parameters = buildParameters(annotations);
    const responses = buildResponses(annotations, usedSchemas);
    const requestBody = buildRequestBody(annotations, usedSchemas);

    const operation: OpenApiOperation = {
      operationId,
      summary: annotations.summary,
      description: "",
      tags: [],
      parameters,
      responses,
    };

    if (requestBody) {
      (operation as Record<string, unknown>).requestBody = requestBody;
    }

    pathItem[method.toLowerCase()] = operation;
  }

  if (Object.keys(pathItem).length === 0) return null;
  return { apiPath, pathItem };
}

async function collectRouteFiles(dirPath: string): Promise<string[]> {
  const entries = await readdir(path.join(ROOT, dirPath), {
    withFileTypes: true,
  });

  const routeFiles: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      routeFiles.push(...(await collectRouteFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && entry.name === "route.ts") {
      routeFiles.push(entryPath);
    }
  }

  return routeFiles;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const configPath = path.join(ROOT, "next.openapi.json");
  const config = generatorConfigSchema.parse(
    JSON.parse(await readFile(configPath, "utf8")),
  );

  const usedSchemas = new Set<string>();

  // Find all route files, including hidden segments such as .well-known.
  const routeFiles = await collectRouteFiles("src/app");
  routeFiles.sort();

  const pathEntries: Array<[string, OpenApiPathItem]> = [];

  for (const filePath of routeFiles) {
    const result = await processRouteFile(filePath, usedSchemas);
    if (result) {
      pathEntries.push([result.apiPath, result.pathItem]);
    }
  }

  // Build component schemas for all used schema names
  const componentSchemas: Record<string, JsonSchema> = {};
  for (const name of usedSchemas) {
    componentSchemas[name] = getSchemaJsonSchema(name);
  }

  const doc: OpenApiDocument = {
    openapi: config.openapi ?? "3.0.0",
    info: config.info ?? {
      title: "Life@USTC API",
      version: "1.0.0",
      description: "OpenAPI document generated from Next.js routes",
    },
    servers: config.servers ?? [
      { url: "http://localhost:3000", description: "Local server" },
    ],
    paths: Object.fromEntries(pathEntries),
    components: { schemas: componentSchemas },
  };

  const outputPath = path.join(ROOT, OPENAPI_SPEC_RELATIVE_PATH);
  await writeFile(outputPath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  console.log(
    `Generated ${pathEntries.length} paths, ${usedSchemas.size} component schemas.`,
  );
  console.log(`Written to ${outputPath}`);
}

await main();
