/**
 * Custom OpenAPI spec generator replacing next-openapi-gen.
 *
 * Reads route files, extracts JSDoc annotations, and generates
 * the pre-postprocessed OpenAPI document consumed by the postprocess step.
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
  // filePath is relative to ROOT, e.g. "src/routes/api/comments/[id]/+server.ts"
  const relative = filePath
    .replace(/^src\/routes/, "")
    .replace(/\/\+server\.ts$/, "");
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

  if (
    new RegExp(`export\\s+const\\s+${httpMethod}\\b(?:\\s*:[^=]+)?\\s*=`).test(
      source,
    )
  ) {
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
          exportKind === "const"
            ? `/\\*\\*[\\s\\S]*?\\*/\\s*export\\s+const\\s+${httpMethod}\\b(?:\\s*:[^=]+)?\\s*=`
            : `/\\*\\*[\\s\\S]*?\\*/\\s*export\\s+(?:async\\s+)?function\\s+${httpMethod}\\b`,
          "g",
        );
  const match = pattern.exec(source);
  if (!match) {
    const wrappedMatch = new RegExp(
      `export\\s+const\\s+${httpMethod}\\s*=\\s*observedApiRoute\\s*\\(\\s*(\\w+)\\s*\\)`,
    ).exec(source);
    if (!wrappedMatch) return null;

    const handlerName = wrappedMatch[1];
    const handlerPattern = new RegExp(
      `/\\*\\*[\\s\\S]*?\\*/\\s*(?:async\\s+)?function\\s+${handlerName}\\b`,
      "g",
    );
    const handlerMatch = handlerPattern.exec(source);
    if (!handlerMatch) return null;

    return parseJsDocAnnotations(handlerMatch[0]);
  }

  return parseJsDocAnnotations(match[0]);
}

function parseJsDocAnnotations(jsdoc: string): HandlerAnnotations {
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

const OPENAPI_EXCLUDED_ROUTES = new Set([
  "src/routes/api/health/+server.ts",
  "src/routes/api/metrics/+server.ts",
  "src/routes/api/readiness/+server.ts",
]);

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
      exportKind !== "destructured" ||
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

    if (entry.isFile() && entry.name === "+server.ts") {
      routeFiles.push(entryPath);
    }
  }

  return routeFiles;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function generateOpenApiSpec() {
  const configPath = path.join(ROOT, "svelte.openapi.json");
  const config = generatorConfigSchema.parse(
    JSON.parse(await readFile(configPath, "utf8")),
  );

  const usedSchemas = new Set<string>();

  // Find all SvelteKit endpoint files, including hidden segments such as .well-known.
  const routeFiles = await collectRouteFiles("src/routes");
  routeFiles.sort();

  const pathEntries: Array<[string, OpenApiPathItem]> = [];

  for (const filePath of routeFiles) {
    if (OPENAPI_EXCLUDED_ROUTES.has(filePath)) {
      continue;
    }

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
      description: "OpenAPI document generated from SvelteKit routes",
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

// ── Postprocess generated document ───────────────────────────────────────────

type MutableOpenApiDocument = {
  openapi?: string;
  info?: unknown;
  servers?: unknown;
  paths?: Record<string, Record<string, Record<string, unknown>>>;
  components?: unknown;
  tags?: Array<{ name: string; description?: string }>;
};

type MutableOpenApiOperation = Record<string, unknown>;

const TAG_DESCRIPTIONS: Record<string, string> = {
  Admin: "Admin and moderation endpoints",
  Comments: "Comment threads, reactions, and moderation",
  Homeworks: "Homework management and completion status",
  Uploads: "Upload presign, finalize, and file management",
  Descriptions: "User-generated description content and history",
  Sections: "Course sections, calendars, and schedules",
  Courses: "Course catalog and search",
  Teachers: "Teacher directory and search",
  Schedules: "Schedules search and filtering",
  Semesters: "Semester listing and current semester",
  Calendar: "Calendar selections and exports",
  Bus: "Shuttle bus schedules and preferences",
  Todos: "Personal todo management",
  Metadata: "Metadata dictionaries for filters",
  Me: "Current user profile, subscriptions, and personal data",
  DashboardLinks: "Dashboard link pinning and click tracking",
  Locale: "Locale switching and locale cookies",
  OpenAPI: "OpenAPI document endpoint",
  Api: "General API endpoints",
};

const TAG_ORDER = [
  "Admin",
  "Comments",
  "Homeworks",
  "Uploads",
  "Descriptions",
  "Sections",
  "Courses",
  "Teachers",
  "Schedules",
  "Semesters",
  "Calendar",
  "Bus",
  "Todos",
  "Me",
  "DashboardLinks",
  "Locale",
  "Metadata",
  "OpenAPI",
  "Api",
];

const TAG_BY_SEGMENT: Record<string, string> = {
  comments: "Comments",
  homeworks: "Homeworks",
  uploads: "Uploads",
  descriptions: "Descriptions",
  sections: "Sections",
  courses: "Courses",
  teachers: "Teachers",
  schedules: "Schedules",
  semesters: "Semesters",
  "calendar-subscriptions": "Calendar",
  bus: "Bus",
  todos: "Todos",
  metadata: "Metadata",
  me: "Me",
  "dashboard-links": "DashboardLinks",
  locale: "Locale",
  openapi: "OpenAPI",
};

const SINGULAR_RESOURCE_NAMES: Record<string, string> = {
  comments: "Comment",
  homeworks: "Homework",
  uploads: "Upload",
  descriptions: "Description",
  sections: "Section",
  courses: "Course",
  teachers: "Teacher",
  schedules: "Schedule",
  semesters: "Semester",
  todos: "Todo",
  users: "User",
  suspensions: "Suspension",
  "calendar-subscriptions": "CalendarSubscription",
  "dashboard-links": "DashboardLink",
};

function getApiSegments(path: string) {
  return path.split("/").filter(Boolean).slice(1);
}

function toPascalCase(value: string) {
  return value
    .split(/[-_.]/g)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join("");
}

function getCollectionName(segment: string) {
  return toPascalCase(segment);
}

function getSingularName(segment: string) {
  return (
    SINGULAR_RESOURCE_NAMES[segment] ??
    getCollectionName(segment).replace(/s$/, "")
  );
}

function tagForPath(path: string): { name: string; description: string } {
  const segments = getApiSegments(path);
  const name =
    segments[0] === "admin"
      ? "Admin"
      : segments[0] === "users" && segments.at(-1) === "calendar.ics"
        ? "Calendar"
        : ((segments[0] ? TAG_BY_SEGMENT[segments[0]] : undefined) ?? "Api");

  return {
    name,
    description: TAG_DESCRIPTIONS[name] ?? TAG_DESCRIPTIONS.Api,
  };
}

function isOperationKey(key: string) {
  return [
    "get",
    "post",
    "put",
    "patch",
    "delete",
    "head",
    "options",
    "trace",
  ].includes(key);
}

function rewriteOperationId(
  method: string,
  path: string,
  currentId: string,
): string {
  const segments = getApiSegments(path);
  if (segments.length === 0) {
    return currentId;
  }

  const isAdmin = segments[0] === "admin";
  const resourceSegments = isAdmin ? segments.slice(1) : segments;
  const [resource, secondSegment, thirdSegment] = resourceSegments;
  const adminPrefix = isAdmin ? "Admin" : "";
  const hasResourceId = secondSegment?.startsWith("{") ?? false;

  if (!resource) {
    return currentId;
  }

  if (resource === "bus" && resourceSegments.length === 1 && method === "get") {
    return "queryBus";
  }

  if (resource === "bus" && secondSegment === "preferences") {
    return method === "get" ? "getBusPreferences" : "setBusPreferences";
  }

  if (
    !isAdmin &&
    resource === "descriptions" &&
    resourceSegments.length === 1
  ) {
    return method === "get" ? "getDescription" : "upsertDescription";
  }

  if (
    resource === "semesters" &&
    secondSegment === "current" &&
    method === "get"
  ) {
    return "getCurrentSemester";
  }

  if (resource === "metadata" && method === "get") {
    return "getMetadata";
  }

  if (resource === "locale" && method === "post") {
    return "setLocale";
  }

  if (resource === "openapi" && method === "get") {
    return "getOpenApiSpec";
  }

  if (
    resource === "me" &&
    secondSegment === "subscriptions" &&
    thirdSegment === "homeworks" &&
    method === "get"
  ) {
    return "getSubscribedHomeworks";
  }

  if (resource === "me" && resourceSegments.length === 1 && method === "get") {
    return "getMe";
  }

  if (resource === "dashboard-links" && secondSegment === "visit") {
    return method === "get" ? "visitDashboardLink" : "recordDashboardLinkVisit";
  }

  if (
    resource === "dashboard-links" &&
    secondSegment === "pin" &&
    method === "post"
  ) {
    return "pinDashboardLink";
  }

  if (resource === "calendar-subscriptions" && secondSegment === "current") {
    return "getCurrentCalendarSubscription";
  }

  if (
    resource === "calendar-subscriptions" &&
    resourceSegments.length === 1 &&
    method === "post"
  ) {
    return "setCalendarSubscription";
  }

  if (
    resource === "users" &&
    segments.at(-1) === "calendar.ics" &&
    method === "get"
  ) {
    return "getUserCalendar";
  }

  if (
    resource === "sections" &&
    secondSegment === "match-codes" &&
    method === "post"
  ) {
    return "matchSectionCodes";
  }

  if (
    resource === "sections" &&
    segments.at(-1) === "calendar.ics" &&
    method === "get"
  ) {
    return hasResourceId ? "getSectionCalendar" : "getSectionsCalendar";
  }

  if (
    resource === "sections" &&
    thirdSegment === "schedules" &&
    method === "get"
  ) {
    return "getSectionSchedules";
  }

  if (
    resource === "sections" &&
    thirdSegment === "schedule-groups" &&
    method === "get"
  ) {
    return "getSectionScheduleGroups";
  }

  if (
    resource === "uploads" &&
    secondSegment === "complete" &&
    method === "post"
  ) {
    return "completeUpload";
  }

  if (
    resource === "uploads" &&
    thirdSegment === "download" &&
    method === "get"
  ) {
    return "downloadUpload";
  }

  if (
    resource === "homeworks" &&
    thirdSegment === "completion" &&
    method === "put"
  ) {
    return "setHomeworkCompletion";
  }

  if (resource === "comments" && thirdSegment === "reactions") {
    return method === "post" ? "addCommentReaction" : "removeCommentReaction";
  }

  if (
    isAdmin &&
    resource === "comments" &&
    hasResourceId &&
    method === "patch"
  ) {
    return "moderateAdminComment";
  }

  if (!hasResourceId && resourceSegments.length === 1) {
    if (method === "get") {
      return `list${adminPrefix}${getCollectionName(resource)}`;
    }
    if (method === "post") {
      return `create${adminPrefix}${getSingularName(resource)}`;
    }
  }

  if (hasResourceId && resourceSegments.length === 2) {
    const verb =
      method === "get"
        ? "get"
        : method === "patch"
          ? "update"
          : method === "delete"
            ? "delete"
            : method === "put"
              ? "set"
              : method === "post"
                ? "create"
                : "";

    if (verb) {
      return `${verb}${adminPrefix}${getSingularName(resource)}`;
    }
  }

  return currentId;
}

function sortPathItemKeys(pathItem: Record<string, unknown>) {
  const operationOrder = [
    "get",
    "post",
    "put",
    "patch",
    "delete",
    "head",
    "options",
    "trace",
  ];

  const keys = Object.keys(pathItem);
  keys.sort((a, b) => {
    const ai = operationOrder.indexOf(a);
    const bi = operationOrder.indexOf(b);
    if (ai !== -1 || bi !== -1) {
      return (
        (ai === -1 ? Number.POSITIVE_INFINITY : ai) -
        (bi === -1 ? Number.POSITIVE_INFINITY : bi)
      );
    }
    return a.localeCompare(b);
  });

  const next: Record<string, unknown> = {};
  for (const key of keys) {
    next[key] = pathItem[key];
  }
  return next;
}

function buildTopLevelTags(
  paths: NonNullable<MutableOpenApiDocument["paths"]>,
) {
  const byName = new Map<string, { name: string; description: string }>();
  for (const path of Object.keys(paths)) {
    const tag = tagForPath(path);
    byName.set(tag.name, tag);
  }

  const preferredOrder = TAG_ORDER;

  const tags = Array.from(byName.values());
  tags.sort((a, b) => {
    const ai = preferredOrder.indexOf(a.name);
    const bi = preferredOrder.indexOf(b.name);
    if (ai !== -1 || bi !== -1) {
      return (
        (ai === -1 ? Number.POSITIVE_INFINITY : ai) -
        (bi === -1 ? Number.POSITIVE_INFINITY : bi)
      );
    }
    return a.name.localeCompare(b.name);
  });

  return tags.map((t) => ({ name: t.name, description: t.description }));
}

function setRedirectResponse(
  operation: MutableOpenApiOperation,
  statusCode: number,
  description: string,
) {
  operation.responses = {
    [String(statusCode)]: {
      description,
      headers: {
        Location: {
          description: "Redirect target URL",
          schema: { type: "string" },
        },
      },
    },
  };
}

function setFormRequestBody(
  operation: MutableOpenApiOperation,
  schemaRef: string,
) {
  operation.requestBody = {
    required: true,
    content: {
      "application/x-www-form-urlencoded": {
        schema: {
          $ref: schemaRef,
        },
      },
    },
  };
}

function patchRedirectOperations(
  paths: NonNullable<MutableOpenApiDocument["paths"]>,
) {
  const pinPost = paths["/api/dashboard-links/pin"]?.post as
    | MutableOpenApiOperation
    | undefined;
  if (pinPost) {
    setFormRequestBody(
      pinPost,
      "#/components/schemas/dashboardLinkPinRequestSchema",
    );
    setRedirectResponse(pinPost, 303, "Redirect after pin/unpin");
  }

  const visitGet = paths["/api/dashboard-links/visit"]?.get as
    | MutableOpenApiOperation
    | undefined;
  if (visitGet) {
    setRedirectResponse(visitGet, 307, "Temporary redirect to target link");
  }

  const visitPost = paths["/api/dashboard-links/visit"]?.post as
    | MutableOpenApiOperation
    | undefined;
  if (visitPost) {
    setFormRequestBody(
      visitPost,
      "#/components/schemas/dashboardLinkVisitRequestSchema",
    );
    setRedirectResponse(visitPost, 303, "Redirect after recording link click");
  }
}

// ── Fix OpenAPI 3.1 → 3.0 exclusive min/max ─────────────────────────────────

/**
 * In OpenAPI 3.1 / JSON Schema 2020-12, exclusiveMinimum and exclusiveMaximum
 * are numbers. In 3.0 they are booleans and the threshold is set via
 * minimum / maximum. Zod's toJSONSchema emits the 3.1 form but we declare
 * 3.0, so we patch here.
 */
function fixExclusiveMinMax(obj: unknown): void {
  if (obj === null || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (const item of obj) fixExclusiveMinMax(item);
    return;
  }
  const record = obj as Record<string, unknown>;
  if (typeof record.exclusiveMinimum === "number") {
    record.minimum = record.exclusiveMinimum;
    record.exclusiveMinimum = true;
  }
  if (typeof record.exclusiveMaximum === "number") {
    record.maximum = record.exclusiveMaximum;
    record.exclusiveMaximum = true;
  }
  for (const value of Object.values(record)) {
    fixExclusiveMinMax(value);
  }
}

/**
 * Zod's toJSONSchema may emit `$defs` with `$ref: "#/$defs/..."` inside
 * component schemas. OpenAPI 3.0 doesn't support `$defs`, so we inline
 * every `$ref` that points at a `$defs` entry and then remove the key.
 *
 * For recursive schemas (e.g. comment replies referencing the comment schema),
 * we replace self-references with an empty object to break the cycle.
 */
function inlineDefs(obj: unknown): void {
  if (obj === null || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (const item of obj) inlineDefs(item);
    return;
  }
  const record = obj as Record<string, unknown>;
  const defs = record.$defs as Record<string, unknown> | undefined;
  if (defs && typeof defs === "object") {
    // Recursively resolve $ref: "#/$defs/..." inside this schema
    resolveLocalRefs(record, defs, 0);
    delete record.$defs;
  }
  for (const value of Object.values(record)) {
    inlineDefs(value);
  }
}

const MAX_INLINE_DEPTH = 3;

function resolveLocalRefs(
  obj: unknown,
  defs: Record<string, unknown>,
  depth: number,
): void {
  if (obj === null || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const item = obj[i] as Record<string, unknown>;
      if (
        item &&
        typeof item.$ref === "string" &&
        item.$ref.startsWith("#/$defs/")
      ) {
        const defName = item.$ref.slice("#/$defs/".length);
        if (defs[defName] && depth < MAX_INLINE_DEPTH) {
          const inlined = JSON.parse(JSON.stringify(defs[defName]));
          resolveLocalRefs(inlined, defs, depth + 1);
          obj[i] = inlined;
        } else {
          // Recursive or too deep — replace with empty schema
          obj[i] = { type: "object", description: "(recursive)" };
        }
      } else {
        resolveLocalRefs(item, defs, depth);
      }
    }
    return;
  }
  const record = obj as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof (value as Record<string, unknown>).$ref === "string"
    ) {
      const ref = (value as Record<string, unknown>).$ref as string;
      if (ref.startsWith("#/$defs/")) {
        const defName = ref.slice("#/$defs/".length);
        if (defs[defName] && depth < MAX_INLINE_DEPTH) {
          const inlined = JSON.parse(JSON.stringify(defs[defName]));
          resolveLocalRefs(inlined, defs, depth + 1);
          record[key] = inlined;
        } else {
          record[key] = { type: "object", description: "(recursive)" };
        }
      }
    }
    resolveLocalRefs(value, defs, depth);
  }
}

/**
 * Convert OpenAPI 3.1 nullable patterns to 3.0 style.
 * 3.1: `anyOf: [{type: "string"}, {type: "null"}]`
 * 3.0: `{type: "string", nullable: true}`
 */
function fixAnyOfNullable(obj: unknown): void {
  if (obj === null || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (const item of obj) fixAnyOfNullable(item);
    return;
  }
  const record = obj as Record<string, unknown>;

  if (Array.isArray(record.anyOf) && record.anyOf.length === 2) {
    const variants = record.anyOf as Array<Record<string, unknown>>;
    const nullIdx = variants.findIndex(
      (v) =>
        typeof v === "object" &&
        v !== null &&
        (v as Record<string, unknown>).type === "null",
    );
    if (nullIdx !== -1) {
      const other = variants[1 - nullIdx];
      if (other && typeof other === "object") {
        // Replace this schema node in-place with the non-null variant + nullable: true
        delete record.anyOf;
        for (const [k, v] of Object.entries(other)) {
          record[k] = v;
        }
        record.nullable = true;
      }
    }
  }

  for (const value of Object.values(record)) {
    fixAnyOfNullable(value);
  }
}

/**
 * Simplify remaining anyOf unions that oapi-codegen can't handle.
 * - `anyOf: [{type: "string"}, {type: "number"}]` → `{type: "string"}`
 *   (Zod coerce patterns — server accepts both, string is most permissive)
 * - `anyOf: [{type: "integer"}, {type: "string"}, {type: "null"}]` → `{type: "string", nullable: true}`
 * - `anyOf: [{obj: prop: null}, {obj: prop: {...}}]` → `{obj: prop: {... nullable: true}}`
 */
function simplifyAnyOfUnions(obj: unknown): void {
  if (obj === null || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (const item of obj) simplifyAnyOfUnions(item);
    return;
  }
  const record = obj as Record<string, unknown>;

  if (Array.isArray(record.anyOf)) {
    const variants = record.anyOf as Array<Record<string, unknown>>;
    const types = variants
      .filter((v) => typeof v === "object" && v !== null && "type" in v)
      .map((v) => v.type as string);

    // Only simplify if all variants are simple type objects (no $ref, no complex schemas)
    const allSimple = variants.every(
      (v) =>
        typeof v === "object" &&
        v !== null &&
        "type" in v &&
        typeof v.type === "string",
    );

    if (allSimple && types.length >= 2) {
      const hasNull = types.includes("null");
      const nonNull = types.filter((t) => t !== "null");

      // Only simplify scalar type unions (string, number, integer, boolean)
      // Don't simplify object unions — they're genuine discriminated unions
      const scalarTypes = ["string", "number", "integer", "boolean"];
      const allScalar = nonNull.every((t) => scalarTypes.includes(t));

      if (allScalar) {
        // Pick the most permissive type: prefer "string" if present, else first non-null
        const chosen = nonNull.includes("string") ? "string" : nonNull[0];
        if (chosen) {
          delete record.anyOf;
          record.type = chosen;
          if (hasNull) {
            record.nullable = true;
          }
        }
      }
    }

    // Handle object-union nullable pattern:
    // anyOf: [{type:object, props:{x: {type:null}}}, {type:object, props:{x: {type:object,...}}}]
    // → {type:object, props:{x: {..., nullable:true}}}
    if (
      variants.length === 2 &&
      variants.every(
        (v) =>
          v.type === "object" &&
          v.properties &&
          typeof v.properties === "object",
      )
    ) {
      const [a, b] = variants;
      const propsA = a.properties as Record<string, Record<string, unknown>>;
      const propsB = b.properties as Record<string, Record<string, unknown>>;
      const keysA = Object.keys(propsA);
      const keysB = Object.keys(propsB);

      // Same keys — try to merge nullable properties
      if (
        keysA.length === keysB.length &&
        keysA.every((k) => keysB.includes(k))
      ) {
        const merged: Record<string, Record<string, unknown>> = {};
        let canMerge = true;

        for (const key of keysA) {
          const valA = propsA[key];
          const valB = propsB[key];
          if (valA?.type === "null" && valB?.type !== "null") {
            merged[key] = { ...valB, nullable: true };
          } else if (valB?.type === "null" && valA?.type !== "null") {
            merged[key] = { ...valA, nullable: true };
          } else if (JSON.stringify(valA) === JSON.stringify(valB)) {
            merged[key] = valA;
          } else {
            canMerge = false;
            break;
          }
        }

        if (canMerge) {
          delete record.anyOf;
          record.type = "object";
          record.properties = merged;
          // Use required from the variant with the real types
          record.required = b.required ?? a.required;
          record.additionalProperties = false;
        }
      }
    }
  }

  for (const value of Object.values(record)) {
    simplifyAnyOfUnions(value);
  }
}

async function postprocessOpenApiSpec() {
  const filePath = new URL(
    `../../../${OPENAPI_SPEC_RELATIVE_PATH}`,
    import.meta.url,
  );
  const raw = await readFile(filePath, "utf8");
  const doc = JSON.parse(raw) as MutableOpenApiDocument;

  if (!doc.paths || typeof doc.paths !== "object") {
    throw new Error("Invalid OpenAPI document: missing paths");
  }

  const paths = doc.paths;

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== "object") {
      continue;
    }

    const tag = tagForPath(path);
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!isOperationKey(method)) {
        continue;
      }
      if (!operation || typeof operation !== "object") {
        continue;
      }
      (operation as { tags?: unknown }).tags = [tag.name];

      // Rewrite operationId to Go-friendly camelCase names
      const currentId = (operation as { operationId?: string }).operationId;
      if (currentId) {
        (operation as { operationId?: string }).operationId =
          rewriteOperationId(method, path, currentId);
      }
    }
  }

  const sortedPaths = Object.fromEntries(
    Object.entries(paths)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, pathItem]) => {
        if (!pathItem || typeof pathItem !== "object") {
          return [path, pathItem];
        }
        return [path, sortPathItemKeys(pathItem)];
      }),
  ) as NonNullable<MutableOpenApiDocument["paths"]>;

  doc.paths = sortedPaths;
  patchRedirectOperations(sortedPaths);

  doc.tags = buildTopLevelTags(sortedPaths);

  // Fix OpenAPI 3.1-style exclusiveMinimum/exclusiveMaximum (number) to 3.0 (boolean)
  fixExclusiveMinMax(doc);

  // Inline $defs from Zod's JSON Schema output (not valid in OpenAPI 3.0)
  inlineDefs(doc);

  // Convert anyOf nullable patterns to OpenAPI 3.0 nullable: true
  fixAnyOfNullable(doc);

  // Simplify anyOf union types (e.g. string|number) to a single type for 3.0 compat
  simplifyAnyOfUnions(doc);

  await writeFile(filePath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
}
await generateOpenApiSpec();
await postprocessOpenApiSpec();
