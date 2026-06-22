/**
 * Custom OpenAPI spec generator replacing next-openapi-gen.
 *
 * Reads route files, extracts JSDoc annotations, and lets zod-openapi render
 * Zod request/response schemas into the generated OpenAPI document.
 */

import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { z } from "zod";
import { createDocument } from "zod-openapi";
import * as requestSchemas from "../../../src/lib/api/schemas/request-schemas";
import * as responseSchemas from "../../../src/lib/api/schemas/response-schemas";
import { OPENAPI_SPEC_RELATIVE_PATH } from "../../../src/lib/openapi/spec";
import {
  getRouteExportKind,
  HTTP_METHODS,
  type RouteExportKind,
} from "../../shared/route-exports";
import { buildScenarioOpenApiExamples } from "./scenario-examples";

const ROOT = new URL("../../..", import.meta.url).pathname;

type JsonSchema = Record<string, unknown>;

type OpenApiOperation = {
  operationId: string;
  summary: string;
  description?: string;
  tags: string[];
  requestParams?: {
    path?: z.ZodTypeAny;
    query?: z.ZodTypeAny;
  };
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
  openapi: z
    .enum(["3.0.0", "3.0.1", "3.0.2", "3.0.3", "3.1.0", "3.1.1", "3.2.0"])
    .optional(),
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
const componentSchemas = new Map<string, z.ZodTypeAny>();

for (const [name, value] of Object.entries({
  ...requestSchemas,
  ...responseSchemas,
})) {
  if (value && typeof value === "object" && "_def" in value) {
    allSchemas[name] = value as z.ZodTypeAny;
  }
}

function getSchema(name: string): z.ZodTypeAny {
  const schema = allSchemas[name];
  if (!schema) {
    throw new Error(`OpenAPI annotation references unknown schema: ${name}`);
  }
  return schema;
}

function getComponentSchema(name: string): z.ZodTypeAny {
  const existing = componentSchemas.get(name);
  if (existing) {
    return existing;
  }

  const schema = getSchema(name).meta({ id: name });
  componentSchemas.set(name, schema);
  return schema;
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

function extractJsDocAnnotations(
  source: string,
  httpMethod: string,
  exportKind: RouteExportKind,
): HandlerAnnotations | null {
  const exportPattern =
    exportKind === "destructured"
      ? new RegExp(
          `export\\s+const\\s*\\{(?=[^}]*\\b${httpMethod}\\b)[^}]*\\}\\s*=`,
          "s",
        )
      : new RegExp(
          exportKind === "const"
            ? `export\\s+const\\s+${httpMethod}\\b(?:\\s*:[^=]+)?\\s*=`
            : `export\\s+(?:async\\s+)?function\\s+${httpMethod}\\b`,
        );

  const match = exportPattern.exec(source);
  const annotations = match ? parseJsDocBefore(source, match.index) : null;
  if (annotations) return annotations;

  const wrappedMatch = new RegExp(
    `export\\s+const\\s+${httpMethod}\\s*=\\s*observedApiRoute\\s*\\(\\s*(\\w+)\\s*\\)`,
  ).exec(source);
  if (!wrappedMatch) return null;

  const handlerName = wrappedMatch[1];
  const handlerPattern = new RegExp(
    `(?:async\\s+)?function\\s+${handlerName}\\b`,
  );
  const handlerMatch = handlerPattern.exec(source);
  if (!handlerMatch) return null;

  return parseJsDocBefore(source, handlerMatch.index);
}

function parseJsDocBefore(
  source: string,
  declarationIndex: number,
): HandlerAnnotations | null {
  const prefix = source.slice(0, declarationIndex);
  const commentStart = prefix.lastIndexOf("/**");
  if (commentStart === -1) return null;

  const candidate = prefix.slice(commentStart);
  if (!/^\/\*\*[\s\S]*?\*\/\s*$/.test(candidate)) return null;
  return parseJsDocAnnotations(candidate);
}

function parseJsDocAnnotations(jsdoc: string): HandlerAnnotations {
  // Extract summary (first non-tag line)
  const summaryMatch = /\/\*\*\s*\n\s*\*\s*([^@\n][^\n]*)/.exec(jsdoc);
  const summary = summaryMatch ? summaryMatch[1].trim().replace(/\.$/, "") : "";

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

// ── Request params building ────────────────────────────────────────────────────

function buildRequestParams(
  annotations: HandlerAnnotations,
  usedSchemas: Set<string>,
): OpenApiOperation["requestParams"] | undefined {
  const requestParams: NonNullable<OpenApiOperation["requestParams"]> = {};
  if (annotations.pathParams) {
    usedSchemas.add(annotations.pathParams);
    requestParams.path = getSchema(annotations.pathParams);
  }

  if (annotations.params) {
    usedSchemas.add(annotations.params);
    requestParams.query = getSchema(annotations.params);
  }

  return Object.keys(requestParams).length > 0 ? requestParams : undefined;
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
          schema: getComponentSchema(schemaName as string),
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

  if (annotations.body === "binary") {
    return {
      required: true,
      content: {
        "application/octet-stream": {
          schema: { type: "string", format: "binary" },
        },
      },
    };
  }

  usedSchemas.add(annotations.body);
  return {
    required: true,
    content: {
      "application/json": {
        schema: getComponentSchema(annotations.body),
      },
    },
  };
}

// ── Route file processing ─────────────────────────────────────────────────────

const OPENAPI_EXCLUDED_ROUTES = new Set([
  "src/routes/api/auth/[...auth]/+server.ts",
  "src/routes/api/health/+server.ts",
  "src/routes/api/metrics/+server.ts",
]);
const OPENAPI_ROUTE_ROOTS = ["src/routes/api", "src/routes/.well-known"];

function isOpenApiExcludedRoute(filePath: string) {
  return OPENAPI_EXCLUDED_ROUTES.has(filePath);
}

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

    const annotations = extractJsDocAnnotations(source, method, exportKind);
    if (!annotations) {
      if (method === "OPTIONS") {
        continue;
      }
      throw new Error(`Missing OpenAPI JSDoc for ${method} ${filePath}`);
    }

    const operationId = `${method.toLowerCase()}-${apiPath.replace(/\//g, "-").replace(/[{}]/g, "").replace(/^-/, "")}`;
    const requestParams = buildRequestParams(annotations, usedSchemas);
    const responses = buildResponses(annotations, usedSchemas);
    const requestBody = buildRequestBody(annotations, usedSchemas);

    const operation: OpenApiOperation = {
      operationId,
      summary: annotations.summary,
      tags: [],
      responses,
    };

    if (requestParams) {
      operation.requestParams = requestParams;
    }

    if (requestBody) {
      operation.requestBody = requestBody;
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

async function generateOpenApiSpec(outputPath: string) {
  const configPath = path.join(ROOT, "svelte.openapi.json");
  const config = generatorConfigSchema.parse(
    JSON.parse(await readFile(configPath, "utf8")),
  );

  const usedSchemas = new Set<string>();

  const routeFiles = (
    await Promise.all(
      OPENAPI_ROUTE_ROOTS.map((root) => collectRouteFiles(root)),
    )
  ).flat();
  routeFiles.sort();

  const pathEntries: Array<[string, OpenApiPathItem]> = [];

  for (const filePath of routeFiles) {
    if (isOpenApiExcludedRoute(filePath)) {
      continue;
    }

    const result = await processRouteFile(filePath, usedSchemas);
    if (result) {
      pathEntries.push([result.apiPath, result.pathItem]);
    }
  }

  const doc = createDocument({
    openapi: config.openapi ?? "3.0.0",
    info: config.info ?? {
      title: "Life@USTC API",
      version: "1.0.0",
      description: "OpenAPI document generated from SvelteKit routes",
    },
    servers: config.servers ?? [{ url: "/", description: "Current origin" }],
    paths: Object.fromEntries(pathEntries),
  }) as OpenApiDocument;

  await writeFile(outputPath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
}

// ── Postprocess generated document ───────────────────────────────────────────

type MutableOpenApiDocument = {
  openapi?: string;
  info?: unknown;
  servers?: unknown;
  paths?: Record<string, Record<string, Record<string, unknown>>>;
  components?: unknown;
  tags?: Array<{
    name: string;
    description?: string;
    "x-displayName"?: string;
  }>;
  "x-tagGroups"?: Array<{ name: string; tags: string[] }>;
};

type MutableOpenApiOperation = Record<string, unknown>;
type MutableOpenApiMediaType = Record<string, unknown>;

const SCENARIO_OPENAPI_EXAMPLES = buildScenarioOpenApiExamples();

const TAG_DESCRIPTIONS: Record<string, string> = {
  Admin: "Admin and moderation endpoints",
  Comments: "Comment threads, reactions, and moderation",
  Homeworks: "Homework management and completion status",
  Uploads: "Upload session, R2 object write, finalize, and file management",
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

const TAG_DISPLAY_NAMES: Record<string, string> = {
  DashboardLinks: "Dashboard Links",
  OpenAPI: "OpenAPI",
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

const TAG_GROUPS = [
  {
    name: "Catalog",
    tags: ["Sections", "Courses", "Teachers", "Schedules", "Semesters"],
  },
  {
    name: "Workspace",
    tags: ["Homeworks", "Todos", "Calendar", "Me", "DashboardLinks"],
  },
  {
    name: "Community",
    tags: ["Comments", "Descriptions", "Uploads"],
  },
  {
    name: "Campus Services",
    tags: ["Bus"],
  },
  {
    name: "Platform",
    tags: ["Metadata", "Locale", "OpenAPI", "Api"],
  },
  {
    name: "Admin",
    tags: ["Admin"],
  },
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

  return tags.map((t) => ({
    name: t.name,
    description: t.description,
    ...(TAG_DISPLAY_NAMES[t.name]
      ? { "x-displayName": TAG_DISPLAY_NAMES[t.name] }
      : {}),
  }));
}

function buildTagGroups(tags: NonNullable<MutableOpenApiDocument["tags"]>) {
  const tagNames = new Set(tags.map((tag) => tag.name));
  return TAG_GROUPS.map((group) => ({
    name: group.name,
    tags: group.tags.filter((tag) => tagNames.has(tag)),
  })).filter((group) => group.tags.length > 0);
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

  const deviceAuthorizationPost = paths["/api/auth/oauth2/device-authorization"]
    ?.post as MutableOpenApiOperation | undefined;
  if (deviceAuthorizationPost) {
    setFormRequestBody(
      deviceAuthorizationPost,
      "#/components/schemas/oauthDeviceAuthorizationRequestSchema",
    );
  }

  const tokenPost = paths["/api/auth/oauth2/token"]?.post as
    | MutableOpenApiOperation
    | undefined;
  if (tokenPost) {
    setFormRequestBody(
      tokenPost,
      "#/components/schemas/oauthTokenRequestSchema",
    );
  }
}

function getContentMediaType(
  operation: MutableOpenApiOperation,
  location: "requestBody" | "response",
): MutableOpenApiMediaType | undefined {
  const source =
    location === "requestBody"
      ? operation.requestBody
      : (operation.responses as Record<string, unknown> | undefined)?.["200"];

  if (!source || typeof source !== "object") {
    return undefined;
  }

  const content = (source as { content?: unknown }).content;
  if (!content || typeof content !== "object") {
    return undefined;
  }

  const mediaType = (content as Record<string, unknown>)["application/json"];
  return mediaType && typeof mediaType === "object"
    ? (mediaType as MutableOpenApiMediaType)
    : undefined;
}

function applyScenarioExamples(
  paths: NonNullable<MutableOpenApiDocument["paths"]>,
) {
  for (const [path, pathItem] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (
        !isOperationKey(method) ||
        !operation ||
        typeof operation !== "object"
      ) {
        continue;
      }

      const example =
        SCENARIO_OPENAPI_EXAMPLES[
          `${method.toUpperCase()} ${path}` as keyof typeof SCENARIO_OPENAPI_EXAMPLES
        ];
      if (!example) {
        continue;
      }

      const parameters = (operation as { parameters?: unknown }).parameters;
      if (example.parameters && Array.isArray(parameters)) {
        for (const parameter of parameters) {
          if (!parameter || typeof parameter !== "object") {
            continue;
          }
          const name = (parameter as { name?: unknown }).name;
          if (typeof name === "string" && name in example.parameters) {
            (parameter as { example?: unknown }).example =
              example.parameters[name];
          }
        }
      }

      const requestMediaType = getContentMediaType(
        operation as MutableOpenApiOperation,
        "requestBody",
      );
      if (requestMediaType && example.requestBody !== undefined) {
        requestMediaType.example = example.requestBody;
      }

      const responseMediaType = getContentMediaType(
        operation as MutableOpenApiOperation,
        "response",
      );
      if (responseMediaType && example.response !== undefined) {
        responseMediaType.example = example.response;
      }
    }
  }
}

async function postprocessOpenApiSpec(filePath: string) {
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
  applyScenarioExamples(sortedPaths);

  doc.tags = buildTopLevelTags(sortedPaths);
  doc["x-tagGroups"] = buildTagGroups(doc.tags);

  await writeFile(filePath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
}

async function writeOpenApiSpec(outputPath: string) {
  await generateOpenApiSpec(outputPath);
  await postprocessOpenApiSpec(outputPath);
}

async function checkOpenApiSpec(outputPath: string) {
  const tempDir = await mkdtemp(path.join(tmpdir(), "life-ustc-openapi-"));
  const tempPath = path.join(tempDir, "openapi.generated.json");

  try {
    await writeOpenApiSpec(tempPath);
    const [currentSpec, generatedSpec] = await Promise.all([
      readFile(outputPath, "utf8"),
      readFile(tempPath, "utf8"),
    ]);

    if (currentSpec !== generatedSpec) {
      throw new Error(
        "OpenAPI spec is stale. Run `bun run openapi:generate` and commit public/openapi.generated.json.",
      );
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

const outputPath = path.join(ROOT, OPENAPI_SPEC_RELATIVE_PATH);

if (process.argv.includes("--check")) {
  await checkOpenApiSpec(outputPath);
} else {
  await writeOpenApiSpec(outputPath);
}
