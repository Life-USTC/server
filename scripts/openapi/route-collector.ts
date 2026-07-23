import {
  type FunctionDeclaration,
  type Node,
  type Project,
  type SourceFile,
  SyntaxKind,
} from "ts-morph";
import type { ZodType } from "zod";
import type { SchemaCollector } from "./schema-collector";

const METHODS = ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"] as const;

const ROUTE_PATTERNS = [
  "src/routes/.well-known/**/+server.ts",
  "src/routes/api/**/.well-known/**/+server.ts",
  "src/routes/api/**/+server.ts",
] as const;

const RESPONSE_SHORTCUTS: Record<string, { content: Record<string, unknown> }> =
  {
    calendar: { content: { "text/calendar": { schema: { type: "string" } } } },
    text: { content: { "text/plain": { schema: { type: "string" } } } },
    array: {
      content: {
        "application/json": {
          schema: { type: "array", items: { type: "object" } },
        },
      },
    },
    binary: {
      content: {
        "application/octet-stream": {
          schema: { type: "string", format: "binary" },
        },
      },
    },
  };

const BINARY_REQUEST_BODY = {
  required: true,
  content: {
    "application/octet-stream": {
      schema: { type: "string", format: "binary" },
    },
  },
};

const FORM_URLENCODED_PATHS = new Set([
  "POST /api/auth/oauth2/token",
  "POST /api/auth/oauth2/device-authorization",
  "POST /api/workspace/link-pins",
  "POST /api/catalog/links/resolve",
]);

const REDIRECT_DESCRIPTIONS: Record<
  string,
  Record<string, { description: string; headers?: Record<string, unknown> }>
> = {
  "POST /api/workspace/link-pins": {
    "303": {
      description: "Redirect after pin/unpin",
      headers: {
        Location: {
          description: "Redirect target URL",
          schema: { type: "string" },
        },
      },
    },
  },
  "GET /api/catalog/links/resolve": {
    "307": {
      description: "Temporary redirect to target link",
      headers: {
        Location: {
          description: "Redirect target URL",
          schema: { type: "string" },
        },
      },
    },
  },
  "POST /api/catalog/links/resolve": {
    "303": {
      description: "Redirect after recording link click",
      headers: {
        Location: {
          description: "Redirect target URL",
          schema: { type: "string" },
        },
      },
    },
  },
};

// Pre-computed operationIds that mirror the checked-in spec for existing routes.
// New routes fall back to a deterministic path-derived id.
const OPERATION_ID_OVERRIDES: Record<string, string> = {
  "GET /.well-known/oauth-authorization-server": "listOauthAuthorizationServer",
  "OPTIONS /.well-known/oauth-authorization-server":
    "options-.well-known-oauth-authorization-server",
  "GET /.well-known/oauth-authorization-server/api/auth":
    "get-.well-known-oauth-authorization-server-api-auth",
  "OPTIONS /.well-known/oauth-authorization-server/api/auth":
    "options-.well-known-oauth-authorization-server-api-auth",
  "GET /.well-known/oauth-authorization-server/api/mcp":
    "get-.well-known-oauth-authorization-server-api-mcp",
  "OPTIONS /.well-known/oauth-authorization-server/api/mcp":
    "options-.well-known-oauth-authorization-server-api-mcp",
  "GET /.well-known/oauth-protected-resource": "listOauthProtectedResource",
  "OPTIONS /.well-known/oauth-protected-resource":
    "options-.well-known-oauth-protected-resource",
  "GET /.well-known/oauth-protected-resource/api/mcp":
    "get-.well-known-oauth-protected-resource-api-mcp",
  "OPTIONS /.well-known/oauth-protected-resource/api/mcp":
    "options-.well-known-oauth-protected-resource-api-mcp",
  "GET /.well-known/openid-configuration": "listOpenidConfiguration",
  "OPTIONS /.well-known/openid-configuration":
    "options-.well-known-openid-configuration",
  "GET /.well-known/openid-configuration/api/auth":
    "get-.well-known-openid-configuration-api-auth",
  "OPTIONS /.well-known/openid-configuration/api/auth":
    "options-.well-known-openid-configuration-api-auth",
  "GET /.well-known/openid-configuration/api/mcp":
    "get-.well-known-openid-configuration-api-mcp",
  "OPTIONS /.well-known/openid-configuration/api/mcp":
    "options-.well-known-openid-configuration-api-mcp",
  "GET /api/admin/comments": "listAdminComments",
  "PATCH /api/admin/comments/{id}": "moderateAdminComment",
  "GET /api/admin/descriptions": "listAdminDescriptions",
  "PATCH /api/admin/descriptions/{id}": "updateAdminDescription",
  "GET /api/admin/homeworks": "listAdminHomeworks",
  "DELETE /api/admin/homeworks/{id}": "deleteAdminHomework",
  "GET /api/admin/suspensions": "listAdminSuspensions",
  "POST /api/admin/suspensions": "createAdminSuspension",
  "PATCH /api/admin/suspensions/{id}": "updateAdminSuspension",
  "GET /api/admin/users": "listAdminUsers",
  "PATCH /api/admin/users/{id}": "updateAdminUser",
  "GET /api/auth/.well-known/openid-configuration":
    "get-api-auth-.well-known-openid-configuration",
  "OPTIONS /api/auth/.well-known/openid-configuration":
    "options-api-auth-.well-known-openid-configuration",
  "GET /api/catalog/bus": "catalog_bus_timetable_get",
  "GET /api/catalog/bus/routes": "catalog_bus_route_search",
  "GET /api/catalog/bus/next": "catalog_bus_departure_next",
  "GET /api/workspace/bus-preferences": "workspace_bus_preferences_get",
  "POST /api/workspace/bus-preferences": "workspace_bus_preferences_set",
  "POST /api/workspace/subscriptions": "setCalendarSubscription",
  "POST /api/workspace/subscriptions/batch": "batchUpdateCalendarSubscription",
  "PATCH /api/workspace/subscriptions": "appendCalendarSubscriptionSections",
  "GET /api/workspace/subscriptions/current": "getCurrentCalendarSubscription",
  "POST /api/workspace/subscriptions/query":
    "queryCalendarSubscriptionSections",
  "GET /api/community/comments": "listComments",
  "POST /api/community/comments": "createComment",
  "GET /api/community/comments/{id}": "getComment",
  "PATCH /api/community/comments/{id}": "updateComment",
  "DELETE /api/community/comments/{id}": "deleteComment",
  "DELETE /api/community/comments/batch": "delete-api-comments-batch",
  "POST /api/community/comments/{id}/reactions": "addCommentReaction",
  "DELETE /api/community/comments/{id}/reactions": "removeCommentReaction",
  "GET /api/catalog/courses": "listCourses",
  "GET /api/catalog/courses/{jwId}": "getCourse",
  "GET /api/catalog/links": "catalog_link_list",
  "GET /api/catalog/links/resolve": "catalog_link_resolve",
  "POST /api/catalog/links/resolve": "catalog_link_visit_record",
  "GET /api/workspace/link-pins": "workspace_link_pin_list",
  "POST /api/workspace/link-pins": "workspace_link_pin_set",
  "POST /api/workspace/link-pins/batch": "workspace_link_pin_batch_set",
  "GET /api/community/descriptions": "getDescription",
  "POST /api/community/descriptions": "upsertDescription",
  "GET /api/health": "listHealth",
  "GET /api/community/section-homeworks": "community_section_homework_list",
  "POST /api/community/section-homeworks": "community_section_homework_create",
  "PATCH /api/community/section-homeworks/{id}":
    "community_section_homework_update",
  "DELETE /api/community/section-homeworks/{id}":
    "community_section_homework_delete",
  "PUT /api/workspace/homeworks/{id}/completion": "setHomeworkCompletion",
  "POST /api/account/preferences": "setLocale",
  "GET /api/mcp": "listMcp",
  "POST /api/mcp": "createMcp",
  "GET /api/mcp/.well-known/oauth-authorization-server":
    "get-api-mcp-.well-known-oauth-authorization-server",
  "OPTIONS /api/mcp/.well-known/oauth-authorization-server":
    "options-api-mcp-.well-known-oauth-authorization-server",
  "GET /api/mcp/.well-known/openid-configuration":
    "get-api-mcp-.well-known-openid-configuration",
  "OPTIONS /api/mcp/.well-known/openid-configuration":
    "options-api-mcp-.well-known-openid-configuration",
  "GET /api/account/profile": "account_profile_get",
  "GET /api/community/users/{identifier}": "community_user_get",
  "GET /api/workspace/homeworks": "getSubscribedHomeworks",
  "PUT /api/workspace/homeworks/completions": "put-api-homeworks-completions",
  "GET /api/workspace/overview": "workspace_overview_get",
  "GET /api/workspace/schedules": "workspace_schedule_list",
  "GET /api/catalog/metadata": "getMetadata",
  "GET /api/openapi": "getOpenApiSpec",
  "GET /api/catalog/schedules": "listSchedules",
  "GET /api/catalog/sections": "listSections",
  "GET /api/catalog/sections/{jwId}": "getSection",
  "GET /api/catalog/sections/{jwId}/calendar.ics": "getSectionCalendar",
  "GET /api/catalog/sections/{jwId}/schedule-groups":
    "getSectionScheduleGroups",
  "GET /api/catalog/sections/{jwId}/schedules": "getSectionSchedules",
  "GET /api/catalog/sections/calendar.ics": "getSectionsCalendar",
  "POST /api/catalog/sections/match-codes": "matchSectionCodes",
  "GET /api/catalog/semesters": "listSemesters",
  "GET /api/catalog/semesters/current": "getCurrentSemester",
  "GET /api/catalog/teachers": "listTeachers",
  "GET /api/catalog/teachers/{id}": "getTeacher",
  "GET /api/workspace/todos": "listTodos",
  "POST /api/workspace/todos": "createTodo",
  "PATCH /api/workspace/todos/{id}": "updateTodo",
  "DELETE /api/workspace/todos/{id}": "deleteTodo",
  "PATCH /api/workspace/todos/batch": "patch-api-todos-batch",
  "DELETE /api/workspace/todos/batch": "delete-api-todos-batch",
  "GET /api/workspace/uploads": "listUploads",
  "POST /api/workspace/uploads": "createUpload",
  "PATCH /api/workspace/uploads/{id}": "updateUpload",
  "DELETE /api/workspace/uploads/{id}": "deleteUpload",
  "GET /api/workspace/uploads/{id}/download": "downloadUpload",
  "POST /api/workspace/uploads/complete": "completeUpload",
  "PUT /api/workspace/uploads/object": "put-api-uploads-object",
  "GET /api/calendar-feeds/{credential}.ics": "workspace_calendar_feed_export",
};

export interface RouteCollectorOptions {
  operationIdOverrides?: Record<string, string>;
}

export function collectPaths(
  project: Project,
  schemas: SchemaCollector,
  options: RouteCollectorOptions = {},
) {
  const paths: Record<string, Record<string, unknown>> = {};
  const overrides = {
    ...OPERATION_ID_OVERRIDES,
    ...options.operationIdOverrides,
  };

  // TypeScript project globs skip dot-directories such as .well-known; add them explicitly.
  project.addSourceFilesAtPaths(ROUTE_PATTERNS);

  const routeFileRegex = /src\/routes\/(?:api|\.well-known)\/.*\/\+server\.ts$/;
  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    if (!routeFileRegex.test(filePath)) continue;

    const routePath = routeFileToOpenApiPath(filePath);
    const methods = extractMethods(sourceFile, routePath, schemas, overrides);
    for (const [method, operation] of Object.entries(methods)) {
      paths[routePath] ??= {};
      paths[routePath][method] = operation;
    }
  }

  return paths;
}

function routeFileToOpenApiPath(filePath: string): string {
  const relative = filePath
    .replace(/^.*src\/routes\//, "/")
    .replace(/\/\+server\.ts$/, "");
  return relative.replace(/\[([^\]]+)\]/g, "{$1}");
}

function extractMethods(
  sourceFile: SourceFile,
  routePath: string,
  schemas: SchemaCollector,
  operationIdOverrides: Record<string, string>,
): Record<string, unknown> {
  const operations: Record<string, unknown> = {};
  const exported = sourceFile.getExportedDeclarations();

  for (const method of METHODS) {
    const decls = exported.get(method);
    if (!decls || decls.length === 0) continue;
    const jsDocs = getJsDocsForDeclaration(decls[0]);
    if (jsDocs.length === 0) continue;
    const operation = buildOperation(
      jsDocs,
      routePath,
      method.toLowerCase(),
      schemas,
      operationIdOverrides,
    );
    operations[method.toLowerCase()] = operation;
  }

  return operations;
}

function getJsDocsForDeclaration(decl: Node): import("ts-morph").JSDoc[] {
  if (decl.getKind() === SyntaxKind.FunctionDeclaration) {
    return (decl as FunctionDeclaration).getJsDocs();
  }

  const variableStatement = decl.getFirstAncestorByKind(
    SyntaxKind.VariableStatement,
  );
  if (variableStatement) return variableStatement.getJsDocs();

  const functionDeclaration = decl.getFirstAncestorByKind(
    SyntaxKind.FunctionDeclaration,
  );
  return functionDeclaration?.getJsDocs() ?? [];
}

function buildOperation(
  jsDocs: import("ts-morph").JSDoc[],
  routePath: string,
  method: string,
  schemas: SchemaCollector,
  operationIdOverrides: Record<string, string>,
): Record<string, unknown> {
  const rawSummary = jsDocs[0]?.getCommentText()?.split("\n")[0]?.trim() ?? "";
  const summary = rawSummary.replace(/\.$/, "");
  const tags = jsDocs.flatMap((doc) =>
    doc.getTags().map((tag) => ({
      name: tag.getTagName(),
      text: (tag.getCommentText() ?? "").trim(),
    })),
  );

  const tag = buildTag(routePath);
  const operation: Record<string, unknown> = {
    operationId: buildOperationId(routePath, method, operationIdOverrides),
    summary,
    tags: [tag],
  };

  const requestParams: Record<string, ZodType> = {};
  let requestBody: Record<string, unknown> | undefined;
  const responses: Record<string, unknown> = {};
  let has401 = false;

  for (const docTag of tags) {
    switch (docTag.name) {
      case "params": {
        const schema = schemas.lookup(docTag.text);
        if (schema) requestParams.query = schema;
        break;
      }
      case "pathParams": {
        const schema = schemas.lookup(docTag.text);
        if (schema) requestParams.path = schema;
        break;
      }
      case "body": {
        requestBody = buildRequestBody(routePath, method, docTag.text, schemas);
        break;
      }
      case "response": {
        const { status, target } = parseResponseTag(docTag.text);
        if (status === "401") has401 = true;
        responses[status] = buildResponse(
          routePath,
          method,
          status,
          target,
          schemas,
        );
        break;
      }
    }
  }

  if (Object.keys(requestParams).length > 0) {
    operation.requestParams = requestParams;
  }
  if (requestBody) {
    operation.requestBody = requestBody;
  }
  if (Object.keys(responses).length > 0) {
    operation.responses = responses;
  }

  const security = buildSecurity(routePath, method, has401);
  if (security) {
    operation.security = security;
  }

  if (routePath.startsWith("/api/admin/")) {
    operation["x-auth-role"] = "admin";
  }

  return operation;
}

function parseResponseTag(text: string): { status: string; target: string } {
  const colon = text.indexOf(":");
  if (colon >= 0) {
    return {
      status: text.slice(0, colon).trim(),
      target: text.slice(colon + 1).trim(),
    };
  }
  if (/^\d{3}$/.test(text)) {
    return { status: text, target: "" };
  }
  return { status: "200", target: text };
}

function schemaRef(name: string): { $ref: string } {
  return { $ref: `#/components/schemas/${name}` };
}

function buildRequestBody(
  routePath: string,
  method: string,
  target: string,
  schemas: SchemaCollector,
): Record<string, unknown> | undefined {
  if (target === "binary") return BINARY_REQUEST_BODY;

  const registered = schemas.register(target);
  if (!registered) return undefined;

  const mediaType = FORM_URLENCODED_PATHS.has(
    `${method.toUpperCase()} ${routePath}`,
  )
    ? "application/x-www-form-urlencoded"
    : "application/json";

  return {
    required: true,
    content: { [mediaType]: { schema: schemaRef(target) } },
  };
}

function buildResponse(
  routePath: string,
  method: string,
  status: string,
  target: string,
  schemas: SchemaCollector,
): Record<string, unknown> {
  const redirect =
    REDIRECT_DESCRIPTIONS[`${method.toUpperCase()} ${routePath}`]?.[status];
  if (redirect) {
    return redirect;
  }

  if (isRedirectStatus(status) && routePath.includes(".well-known")) {
    return {
      description: describeStatusOnly(status),
      headers: {
        Location: { schema: { type: "string", format: "uri" } },
      },
    };
  }

  if (target === "") {
    return { description: describeStatusOnly(status) };
  }

  if (RESPONSE_SHORTCUTS[target]) {
    return {
      description: describeShortcut(target),
      ...RESPONSE_SHORTCUTS[target],
    };
  }

  const registered = schemas.register(target);
  if (!registered) {
    return { description: describeStatusOnly(status) };
  }

  const statusNum = Number.parseInt(status, 10);
  const headers =
    status === "201"
      ? {
          Location: {
            description: "Relative URL of the created resource",
            schema: { type: "string" },
          },
        }
      : status === "429" || status === "503"
        ? {
            "Retry-After": {
              description: "Seconds before retrying the mutation",
              schema: { type: "integer", minimum: 0 },
            },
          }
        : undefined;
  return {
    description: statusNum >= 400 ? "Error response" : "Successful response",
    ...(headers ? { headers } : {}),
    content: {
      "application/json": { schema: schemaRef(target) },
    },
  };
}

function isRedirectStatus(status: string): boolean {
  return status === "307" || status === "303";
}

function describeStatusOnly(status: string): string {
  if (isRedirectStatus(status)) return "Redirect";
  return `Response ${status}`;
}

function describeShortcut(shortcut: string): string {
  switch (shortcut) {
    case "calendar":
      return "Calendar response";
    case "text":
      return "Text response";
    case "array":
      return "Array response";
    case "binary":
      return "Binary response";
    default:
      return "Successful response";
  }
}

function buildOperationId(
  routePath: string,
  method: string,
  overrides: Record<string, string>,
): string {
  const key = `${method.toUpperCase()} ${routePath}`;
  if (overrides[key]) return overrides[key];

  return `${method}-${slugPath(routePath)}`;
}

function slugPath(path: string): string {
  return path
    .replace(/^\//, "")
    .replace(/\{([^}]+)\}/g, "$1")
    .replace(/\//g, "-");
}

function buildTag(routePath: string): string {
  const [, api, scope, domain] = routePath.split("/");
  if (
    api === "api" &&
    scope &&
    domain &&
    ["account", "admin", "catalog", "community", "workspace"].includes(scope)
  ) {
    const canonicalDomain =
      {
        homeworks: "homework",
        links: "link",
        "link-pins": "link-pin",
        schedules: "schedule",
        sections: "section",
        "section-homeworks": "section-homework",
        subscriptions: "subscription",
        todos: "todo",
        uploads: "upload",
        users: "user",
      }[domain] ?? domain;
    return `${scope}.${canonicalDomain}`;
  }
  if (routePath.startsWith("/api/calendar-feeds/")) return "workspace.calendar";
  if (routePath === "/api/openapi") return "OpenAPI";
  if (
    routePath.startsWith("/api/auth") ||
    routePath.startsWith("/api/mcp") ||
    routePath.startsWith("/.well-known")
  ) {
    return "Api";
  }
  return "Api";
}

function buildSecurity(
  routePath: string,
  method: string,
  has401: boolean,
): Array<Record<string, string[]>> | undefined {
  if (!has401) return undefined;

  if (routePath.startsWith("/api/auth")) {
    return undefined;
  }

  if (routePath.startsWith("/api/admin/")) {
    return [{ sessionCookie: [] }];
  }

  if (routePath === "/api/mcp" && method !== "options") {
    return [{ mcpBearerAuth: [] }];
  }

  if (routePath.startsWith("/api/calendar-feeds/")) {
    return [
      { bearerAuth: [] },
      { sessionCookie: [] },
      { calendarFeedToken: [] },
    ];
  }

  return [{ bearerAuth: [] }, { sessionCookie: [] }];
}
