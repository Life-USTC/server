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

function collectTags(paths: Record<string, unknown>) {
  const names = new Set<string>();
  for (const pathItem of Object.values(paths)) {
    if (!pathItem || typeof pathItem !== "object") continue;
    for (const operation of Object.values(pathItem)) {
      if (
        !operation ||
        typeof operation !== "object" ||
        !("tags" in operation)
      ) {
        continue;
      }
      const tags = (operation as { tags?: unknown }).tags;
      if (Array.isArray(tags)) {
        for (const tag of tags) if (typeof tag === "string") names.add(tag);
      }
    }
  }
  return [...names].sort();
}

function buildTagGroups(tagNames: string[]) {
  const groups = [
    ["Catalog", "catalog."],
    ["Workspace", "workspace."],
    ["Community", "community."],
    ["Account", "account."],
    ["Admin", "admin."],
  ] as const;
  const grouped = new Set<string>();
  const result: { name: string; tags: string[] }[] = groups.flatMap(
    ([name, prefix]) => {
      const tags = tagNames.filter((tag) => tag.startsWith(prefix));
      for (const tag of tags) grouped.add(tag);
      return tags.length ? [{ name, tags }] : [];
    },
  );
  const platformTags = tagNames.filter((tag) => !grouped.has(tag));
  if (platformTags.length)
    result.push({ name: "Platform", tags: platformTags });
  return result;
}

export function generateOpenApiDocument(): ReturnType<typeof createDocument> {
  const project = new Project({ tsConfigFilePath: "tsconfig.json" });
  const schemas = new SchemaCollector();
  const paths = collectPaths(project, schemas);
  const tagNames = collectTags(paths);

  const document = {
    ...baseOpenApiDoc,
    info: {
      ...baseOpenApiDoc.info,
      version: "1.0.0",
      description: "OpenAPI document generated from SvelteKit route handlers",
    },
    servers: [{ url: "/", description: "Current origin" }],
    tags: tagNames.map((name) => ({
      name,
      description: `${name} operations`,
    })),
    "x-tagGroups": buildTagGroups(tagNames),
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
