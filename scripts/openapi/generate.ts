import * as fs from "node:fs";
import * as path from "node:path";
import { Project } from "ts-morph";
import { createDocument, type ZodOpenApiObject } from "zod-openapi";
import baseDoc from "../../svelte.openapi.json";
import { collectPaths } from "./route-collector";
import { SchemaCollector } from "./schema-collector";

const baseOpenApiDoc = baseDoc as ZodOpenApiObject;

const SECURITY_SCHEMES = {
  bearerAuth: {
    type: "http" as const,
    scheme: "bearer",
    bearerFormat: "JWT",
    description:
      "OAuth access token accepted by protected REST endpoints when it carries a matching feature:read scope for reads or feature:write scope for mutations. These endpoints also accept an in-site Better Auth session cookie.",
  },
  sessionCookie: {
    type: "apiKey" as const,
    in: "cookie" as const,
    name: "better-auth.session_token",
    description:
      "Better Auth session cookie used by the web UI. Production cookies may use the __Secure- prefix.",
  },
  mcpBearerAuth: {
    type: "http" as const,
    scheme: "bearer",
    bearerFormat: "JWT",
    description:
      "OAuth bearer token for /api/mcp. MCP requires a bearer token with the MCP resource audience and does not accept session cookies.",
  },
  calendarFeedToken: {
    type: "apiKey" as const,
    in: "query" as const,
    name: "token",
    description:
      "Calendar feed token accepted by the personal iCal endpoint. Token-bearing feed URLs may also embed the token in the userId:token path segment.",
  },
};

const ROOT_TAGS = [
  { name: "Admin", description: "Admin and moderation endpoints" },
  {
    name: "Comments",
    description: "Comment threads, reactions, and moderation",
  },
  {
    name: "Homeworks",
    description: "Homework management and completion status",
  },
  {
    name: "Uploads",
    description:
      "Upload session, R2 object write, finalize, and file management",
  },
  {
    name: "Descriptions",
    description: "User-generated description content and history",
  },
  {
    name: "Sections",
    description: "Course sections, calendars, and schedules",
  },
  { name: "Courses", description: "Course catalog and search" },
  { name: "Teachers", description: "Teacher directory and search" },
  { name: "Schedules", description: "Schedules search and filtering" },
  { name: "Semesters", description: "Semester listing and current semester" },
  { name: "Calendar", description: "Calendar selections and exports" },
  { name: "Bus", description: "Shuttle bus schedules and preferences" },
  { name: "Todos", description: "Personal todo management" },
  {
    name: "Me",
    description: "Current user profile, subscriptions, and personal data",
  },
  {
    name: "DashboardLinks",
    description: "Dashboard link pinning and click tracking",
    "x-displayName": "Dashboard Links",
  },
  { name: "Locale", description: "Locale switching and locale cookies" },
  { name: "Metadata", description: "Metadata dictionaries for filters" },
  {
    name: "OpenAPI",
    description: "OpenAPI document endpoint",
    "x-displayName": "OpenAPI",
  },
  { name: "Api", description: "General API endpoints" },
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
  { name: "Community", tags: ["Comments", "Descriptions", "Uploads"] },
  { name: "Campus Services", tags: ["Bus"] },
  { name: "Platform", tags: ["Metadata", "Locale", "OpenAPI", "Api"] },
  { name: "Admin", tags: ["Admin"] },
];

export function generateOpenApiDocument(): ReturnType<typeof createDocument> {
  const project = new Project({ tsConfigFilePath: "tsconfig.json" });
  const schemas = new SchemaCollector();
  const paths = collectPaths(project, schemas);

  const document = {
    ...baseOpenApiDoc,
    info: {
      ...baseOpenApiDoc.info,
      version: "1.0.0",
      description: "OpenAPI document generated from SvelteKit route handlers",
    },
    servers: [{ url: "/", description: "Current origin" }],
    tags: ROOT_TAGS,
    "x-tagGroups": TAG_GROUPS,
    paths,
    components: {
      schemas: schemas.getRegisteredSchemas(),
      securitySchemes: SECURITY_SCHEMES,
    },
  } satisfies ZodOpenApiObject;

  return createDocument(document);
}

if (import.meta.main) {
  const doc = generateOpenApiDocument();
  const out = path.resolve("public/openapi.generated.json");
  fs.writeFileSync(out, `${JSON.stringify(doc, null, 2)}\n`);
  console.log(`Wrote ${out}`);
}
