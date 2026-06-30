import { type FunctionDeclaration, type Node, type Project, type SourceFile, SyntaxKind } from "ts-morph";
import type { ZodType } from "zod";
import type { SchemaCollector } from "./schema-collector";

const METHODS = ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"] as const;

const ROUTE_PATTERNS = [
  "src/routes/.well-known/**/+server.ts",
  "src/routes/api/**/.well-known/**/+server.ts",
  "src/routes/api/**/+server.ts",
] as const;

const RESPONSE_SHORTCUTS: Record<string, { content: Record<string, unknown> }> = {
  calendar: { content: { "text/calendar": { schema: { type: "string" } } } },
  text: { content: { "text/plain": { schema: { type: "string" } } } },
  array: { content: { "application/json": { schema: { type: "array", items: { type: "object" } } } } },
  binary: { content: { "application/octet-stream": { schema: { type: "string", format: "binary" } } } },
};

const BINARY_REQUEST_BODY = {
  required: true,
  content: {
    "application/octet-stream": { schema: { type: "string", format: "binary" } },
  },
};

const FORM_URLENCODED_PATHS = new Set([
  "POST /api/auth/oauth2/token",
  "POST /api/auth/oauth2/device-authorization",
  "POST /api/dashboard-links/pin",
  "POST /api/dashboard-links/visit",
]);

const REDIRECT_DESCRIPTIONS: Record<string, Record<string, { description: string; headers?: Record<string, unknown> }>> = {
  "POST /api/dashboard-links/pin": {
    "303": {
      description: "Redirect after pin/unpin",
      headers: {
        Location: { description: "Redirect target URL", schema: { type: "string" } },
      },
    },
  },
  "GET /api/dashboard-links/visit": {
    "307": {
      description: "Temporary redirect to target link",
      headers: {
        Location: { description: "Redirect target URL", schema: { type: "string" } },
      },
    },
  },
  "POST /api/dashboard-links/visit": {
    "303": {
      description: "Redirect after recording link click",
      headers: {
        Location: { description: "Redirect target URL", schema: { type: "string" } },
      },
    },
  },
};

// Pre-computed operationIds that mirror the checked-in spec for existing routes.
// New routes fall back to a deterministic path-derived id.
const OPERATION_ID_OVERRIDES: Record<string, string> = {
  "GET /.well-known/oauth-authorization-server": "listOauthAuthorizationServer",
  "OPTIONS /.well-known/oauth-authorization-server": "options-.well-known-oauth-authorization-server",
  "GET /.well-known/oauth-authorization-server/api/auth": "get-.well-known-oauth-authorization-server-api-auth",
  "OPTIONS /.well-known/oauth-authorization-server/api/auth": "options-.well-known-oauth-authorization-server-api-auth",
  "GET /.well-known/oauth-authorization-server/api/mcp": "get-.well-known-oauth-authorization-server-api-mcp",
  "OPTIONS /.well-known/oauth-authorization-server/api/mcp": "options-.well-known-oauth-authorization-server-api-mcp",
  "GET /.well-known/oauth-protected-resource": "listOauthProtectedResource",
  "OPTIONS /.well-known/oauth-protected-resource": "options-.well-known-oauth-protected-resource",
  "GET /.well-known/oauth-protected-resource/api/mcp": "get-.well-known-oauth-protected-resource-api-mcp",
  "OPTIONS /.well-known/oauth-protected-resource/api/mcp": "options-.well-known-oauth-protected-resource-api-mcp",
  "GET /.well-known/openid-configuration": "listOpenidConfiguration",
  "OPTIONS /.well-known/openid-configuration": "options-.well-known-openid-configuration",
  "GET /.well-known/openid-configuration/api/auth": "get-.well-known-openid-configuration-api-auth",
  "OPTIONS /.well-known/openid-configuration/api/auth": "options-.well-known-openid-configuration-api-auth",
  "GET /.well-known/openid-configuration/api/mcp": "get-.well-known-openid-configuration-api-mcp",
  "OPTIONS /.well-known/openid-configuration/api/mcp": "options-.well-known-openid-configuration-api-mcp",
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
  "GET /api/auth/.well-known/openid-configuration": "get-api-auth-.well-known-openid-configuration",
  "OPTIONS /api/auth/.well-known/openid-configuration": "options-api-auth-.well-known-openid-configuration",
  "GET /api/bus": "queryBus",
  "GET /api/bus/preferences": "getBusPreferences",
  "POST /api/bus/preferences": "setBusPreferences",
  "POST /api/calendar-subscriptions": "setCalendarSubscription",
  "PATCH /api/calendar-subscriptions": "appendCalendarSubscriptionSections",
  "GET /api/calendar-subscriptions/current": "getCurrentCalendarSubscription",
  "GET /api/comments": "listComments",
  "POST /api/comments": "createComment",
  "GET /api/comments/{id}": "getComment",
  "PATCH /api/comments/{id}": "updateComment",
  "DELETE /api/comments/{id}": "deleteComment",
  "POST /api/comments/{id}/reactions": "addCommentReaction",
  "DELETE /api/comments/{id}/reactions": "removeCommentReaction",
  "GET /api/courses": "listCourses",
  "GET /api/courses/{jwId}": "getCourse",
  "POST /api/dashboard-links/pin": "pinDashboardLink",
  "GET /api/dashboard-links/visit": "visitDashboardLink",
  "POST /api/dashboard-links/visit": "recordDashboardLinkVisit",
  "GET /api/descriptions": "getDescription",
  "POST /api/descriptions": "upsertDescription",
  "GET /api/health": "listHealth",
  "GET /api/homeworks": "listHomeworks",
  "POST /api/homeworks": "createHomework",
  "PATCH /api/homeworks/{id}": "updateHomework",
  "DELETE /api/homeworks/{id}": "deleteHomework",
  "PUT /api/homeworks/{id}/completion": "setHomeworkCompletion",
  "POST /api/locale": "setLocale",
  "GET /api/mcp": "listMcp",
  "POST /api/mcp": "createMcp",
  "GET /api/mcp/.well-known/oauth-authorization-server": "get-api-mcp-.well-known-oauth-authorization-server",
  "OPTIONS /api/mcp/.well-known/oauth-authorization-server": "options-api-mcp-.well-known-oauth-authorization-server",
  "GET /api/mcp/.well-known/openid-configuration": "get-api-mcp-.well-known-openid-configuration",
  "OPTIONS /api/mcp/.well-known/openid-configuration": "options-api-mcp-.well-known-openid-configuration",
  "GET /api/me": "getMe",
  "GET /api/me/subscriptions/homeworks": "getSubscribedHomeworks",
  "GET /api/metadata": "getMetadata",
  "GET /api/metrics": "listMetrics",
  "GET /api/openapi": "getOpenApiSpec",
  "GET /api/readiness": "listReadiness",
  "GET /api/schedules": "listSchedules",
  "GET /api/sections": "listSections",
  "GET /api/sections/{jwId}": "getSection",
  "GET /api/sections/{jwId}/calendar.ics": "getSectionCalendar",
  "GET /api/sections/{jwId}/schedule-groups": "getSectionScheduleGroups",
  "GET /api/sections/{jwId}/schedules": "getSectionSchedules",
  "GET /api/sections/calendar.ics": "getSectionsCalendar",
  "POST /api/sections/match-codes": "matchSectionCodes",
  "GET /api/semesters": "listSemesters",
  "GET /api/semesters/current": "getCurrentSemester",
  "GET /api/teachers": "listTeachers",
  "GET /api/teachers/{id}": "getTeacher",
  "GET /api/todos": "listTodos",
  "POST /api/todos": "createTodo",
  "PATCH /api/todos/{id}": "updateTodo",
  "DELETE /api/todos/{id}": "deleteTodo",
  "GET /api/uploads": "listUploads",
  "POST /api/uploads": "createUpload",
  "PATCH /api/uploads/{id}": "updateUpload",
  "DELETE /api/uploads/{id}": "deleteUpload",
  "GET /api/uploads/{id}/download": "downloadUpload",
  "POST /api/uploads/complete": "completeUpload",
  "GET /api/users/{userId}/calendar.ics": "getUserCalendar",
};

export interface RouteCollectorOptions {
  operationIdOverrides?: Record<string, string>;
}

export function collectPaths(project: Project, schemas: SchemaCollector, options: RouteCollectorOptions = {}) {
  const paths: Record<string, Record<string, unknown>> = {};
  const overrides = { ...OPERATION_ID_OVERRIDES, ...options.operationIdOverrides };

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
    const operation = buildOperation(jsDocs, routePath, method.toLowerCase(), schemas, operationIdOverrides);
    operations[method.toLowerCase()] = operation;
  }

  return operations;
}

function getJsDocsForDeclaration(decl: Node): import("ts-morph").JSDoc[] {
  if (decl.getKind() === SyntaxKind.FunctionDeclaration) {
    return (decl as FunctionDeclaration).getJsDocs();
  }

  const variableStatement = decl.getFirstAncestorByKind(SyntaxKind.VariableStatement);
  if (variableStatement) return variableStatement.getJsDocs();

  const functionDeclaration = decl.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration);
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
        responses[status] = buildResponse(routePath, method, status, target, schemas);
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

  const security = buildSecurity(routePath, method, tag, has401);
  if (security) {
    operation.security = security;
  }

  if (tag === "Admin") {
    operation["x-auth-role"] = "admin";
  }

  return operation;
}

function parseResponseTag(text: string): { status: string; target: string } {
  const colon = text.indexOf(":");
  if (colon >= 0) {
    return { status: text.slice(0, colon).trim(), target: text.slice(colon + 1).trim() };
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

  const mediaType = FORM_URLENCODED_PATHS.has(`${method.toUpperCase()} ${routePath}`)
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
  const redirect = REDIRECT_DESCRIPTIONS[`${method.toUpperCase()} ${routePath}`]?.[status];
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
  return {
    description: statusNum >= 400 ? "Error response" : "Successful response",
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

function buildOperationId(routePath: string, method: string, overrides: Record<string, string>): string {
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
  if (routePath.startsWith("/api/admin/")) return "Admin";
  if (routePath.startsWith("/api/bus")) return "Bus";
  if (routePath.startsWith("/api/calendar-subscriptions")) return "Calendar";
  if (routePath.startsWith("/api/comments")) return "Comments";
  if (routePath.startsWith("/api/courses")) return "Courses";
  if (routePath.startsWith("/api/dashboard-links")) return "DashboardLinks";
  if (routePath.startsWith("/api/descriptions")) return "Descriptions";
  if (routePath.startsWith("/api/homeworks")) return "Homeworks";
  if (routePath === "/api/locale") return "Locale";
  if (routePath === "/api/metadata") return "Metadata";
  if (routePath === "/api/metrics") return "Api";
  if (routePath === "/api/openapi") return "OpenAPI";
  if (routePath === "/api/readiness") return "Api";
  if (routePath.startsWith("/api/me")) return "Me";
  if (routePath === "/api/schedules") return "Schedules";
  if (routePath.startsWith("/api/sections")) return "Sections";
  if (routePath.startsWith("/api/semesters")) return "Semesters";
  if (routePath.startsWith("/api/teachers")) return "Teachers";
  if (routePath.startsWith("/api/todos")) return "Todos";
  if (routePath.startsWith("/api/uploads")) return "Uploads";
  if (routePath === "/api/users/{userId}/calendar.ics") return "Calendar";
  if (routePath.startsWith("/api/users")) return "Api";
  if (routePath.startsWith("/api/auth") || routePath.startsWith("/api/mcp") || routePath.startsWith("/.well-known")) {
    return "Api";
  }
  return "Api";
}

function buildSecurity(
  routePath: string,
  method: string,
  tag: string,
  has401: boolean,
): Array<Record<string, string[]>> | undefined {
  if (!has401) {
    if (routePath === "/api/readiness" || routePath === "/api/metrics") {
      return [{ internalBearerAuth: [] }];
    }
    return undefined;
  }

  if (routePath.startsWith("/api/auth")) {
    return undefined;
  }

  if (tag === "Admin") {
    return [{ sessionCookie: [] }];
  }

  if (routePath === "/api/readiness") {
    return [{ internalBearerAuth: [] }];
  }

  if (routePath === "/api/mcp" && method !== "options") {
    return [{ mcpBearerAuth: [] }];
  }

  if (routePath === "/api/users/{userId}/calendar.ics") {
    return [{ bearerAuth: [] }, { sessionCookie: [] }, { calendarFeedToken: [] }];
  }

  return [{ bearerAuth: [] }, { sessionCookie: [] }];
}
