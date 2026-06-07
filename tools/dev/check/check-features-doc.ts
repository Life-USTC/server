import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { walkFiles } from "../../shared/file-utils";

const featuresDir = "docs/features";
const schemaPath = "docs/features.schema.json";
const prismaPath = "prisma/schema.prisma";
const apiDir = "src/app/api";
const mcpDir = "src/lib/mcp/tools";

type PrismaDocs = {
  enums: Record<string, string[]>;
  models: Record<
    string,
    { fields: Record<string, string>; constraints?: string[] }
  >;
};

type FeatureMeta = {
  query: "sh" | "yq";
  queries: Record<string, string>;
};

function parsePrismaSchema(source: string): PrismaDocs {
  const enums: PrismaDocs["enums"] = {};
  for (const match of source.matchAll(/^enum\s+(\w+)\s*{([\s\S]*?)^}/gm)) {
    const [, name, body] = match;
    enums[name] = body
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("//"));
  }

  const models: PrismaDocs["models"] = {};
  for (const match of source.matchAll(/^model\s+(\w+)\s*{([\s\S]*?)^}/gm)) {
    const [, name, body] = match;
    const fields: Record<string, string> = {};
    const constraints: string[] = [];

    for (const rawLine of body.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("//")) continue;
      if (line.startsWith("@@")) {
        constraints.push(line);
        continue;
      }

      const fieldMatch = line.match(/^(\w+)\s+(.+)$/);
      if (fieldMatch)
        fields[fieldMatch[1]] = fieldMatch[2].replace(/\s+/g, " ");
    }

    models[name] = constraints.length ? { fields, constraints } : { fields };
  }

  return { enums, models };
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function validateFeatureQueries(meta: FeatureMeta) {
  if (meta.query !== "sh") {
    console.error(
      `Feature query validation only supports shell commands; got ${meta.query}`,
    );
    process.exit(1);
  }

  for (const [name, command] of Object.entries(meta.queries)) {
    const result = spawnSync(meta.query, ["-c", command], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    if (result.status === 0) {
      continue;
    }

    console.error(
      `Feature doc query validation failed for meta.queries.${name}`,
    );
    console.error(`Command: ${command}`);
    if (result.stdout.trim()) {
      console.error(result.stdout.trim());
    }
    if (result.stderr.trim()) {
      console.error(result.stderr.trim());
    }
    process.exit(result.status ?? 1);
  }
}

function parseImplementedRoutePath(filePath: string): string {
  const routePath = relative("src/app", filePath)
    .replace(/\\/g, "/")
    .replace(/\/route\.ts$/, "");

  return `/${routePath
    .split("/")
    .map((segment) => {
      const catchAll = segment.match(/^\[\.\.\.(.+)\]$/);
      if (catchAll) return `{${catchAll[1]}}`;
      return segment;
    })
    .join("/")}`;
}

function collectImplementedRestRoutes(): Set<string> {
  const methodPattern =
    /export\s+(?:async\s+function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/g;
  const routes = new Set<string>();

  for (const file of walkFiles(apiDir).filter((path) =>
    path.endsWith("/route.ts"),
  )) {
    const source = readFileSync(file, "utf8");
    const path = parseImplementedRoutePath(file);
    for (const match of source.matchAll(methodPattern)) {
      routes.add(`${match[1]} ${path}`);
    }
  }

  return routes;
}

type FeatureDoc = {
  capabilities?: Record<
    string,
    {
      rest?:
        | "stable"
        | "planned"
        | "unavailable"
        | {
            status?: string;
            routes?: Array<{ path: string; method?: string }>;
          };
      mcp?:
        | "stable"
        | "planned"
        | "unavailable"
        | {
            status?: string;
            tools?: Array<string | { name?: string; status?: string }>;
          };
    }
  >;
};

function collectDocumentedRestRoutes(
  modules: Record<string, unknown>,
): Set<string> {
  const routes = new Set<string>();

  for (const moduleDoc of Object.values(modules) as FeatureDoc[]) {
    for (const capability of Object.values(moduleDoc.capabilities ?? {})) {
      if (!capability || typeof capability !== "object") continue;
      if (!capability.rest || typeof capability.rest !== "object") continue;
      for (const route of capability.rest.routes ?? []) {
        routes.add(`${route.method ?? "GET"} ${route.path}`);
      }
    }
  }

  return routes;
}

function collectImplementedMcpTools(): Set<string> {
  const toolPattern = /registerTool\(\s*["']([^"']+)["']/g;
  const tools = new Set<string>();

  for (const file of walkFiles(mcpDir).filter((path) => path.endsWith(".ts"))) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(toolPattern)) {
      tools.add(match[1]);
    }
  }

  return tools;
}

function collectDocumentedMcpTools(
  modules: Record<string, unknown>,
): Set<string> {
  const tools = new Set<string>();

  for (const moduleDoc of Object.values(modules) as FeatureDoc[]) {
    for (const capability of Object.values(moduleDoc.capabilities ?? {})) {
      if (!capability || typeof capability !== "object") continue;
      if (!capability.mcp || typeof capability.mcp !== "object") continue;
      for (const tool of capability.mcp.tools ?? []) {
        if (typeof tool === "string") {
          tools.add(tool);
          continue;
        }
        if (tool.status === "unavailable") continue;
        if (tool.name) tools.add(tool.name);
      }
    }
  }

  return tools;
}

function isDocumentedRestRouteChecked(route: string): boolean {
  const [, path] = route.split(" ", 2);
  return path.startsWith("/api/") && !path.includes("/.well-known/");
}

function isImplementedRestRouteIgnored(route: string): boolean {
  return (
    route === "GET /api/auth/{auth}" ||
    route === "PATCH /api/auth/{auth}" ||
    route === "PUT /api/auth/{auth}" ||
    route === "DELETE /api/auth/{auth}"
  );
}

// Load and merge modular feature files
if (!existsSync(featuresDir)) {
  console.error(`Features directory not found: ${featuresDir}`);
  process.exit(1);
}

const files = readdirSync(featuresDir).filter((f) => f.endsWith(".json"));
if (files.length === 0) {
  console.error("No feature files found");
  process.exit(1);
}

console.log(`Found ${files.length} feature files`);

const metadataTargets = {
  "_meta.json": "meta",
  "_product.json": "product",
  "_models.json": "models",
  "_enums.json": "enums",
  "_ui.json": "ui",
  "_cases.json": "cases",
  "_audit.json": "audit",
} as const;

// Merge all feature files
const merged: Record<string, unknown> & { modules: Record<string, unknown> } = {
  meta: {},
  product: {},
  models: {},
  enums: {},
  ui: {},
  modules: {},
  cases: {},
  audit: {},
};

for (const file of files.sort()) {
  const path = join(featuresDir, file);
  const content = readFileSync(path, "utf8");
  const data = JSON.parse(content);

  if (file.startsWith("_")) {
    const target = metadataTargets[file as keyof typeof metadataTargets];
    if (!target) {
      console.error(`Unknown metadata file: ${path}`);
      process.exit(1);
    }
    merged[target] = data;
    continue;
  }

  const moduleName = file.replace(".json", "");
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    console.error(`Module file must contain a JSON object: ${path}`);
    process.exit(1);
  }
  merged.modules[moduleName] = data;
}

// Validate against schema
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

if (!validate(merged)) {
  console.error("Feature document schema validation failed:");
  for (const error of validate.errors ?? []) {
    console.error(
      `- ${error.instancePath || "/"} ${error.message ?? "is invalid"}`,
    );
  }
  process.exit(1);
}

validateFeatureQueries(merged.meta as FeatureMeta);

// Validate Prisma sync
const expected = parsePrismaSchema(readFileSync(prismaPath, "utf8"));
const actual = { enums: merged.enums, models: merged.models };

if (stableJson(actual) !== stableJson(expected)) {
  console.error(
    "Feature document model metadata is out of sync with prisma/schema.prisma.",
  );
  process.exit(1);
}

const documentedRestRoutes = collectDocumentedRestRoutes(merged.modules);
const implementedRestRoutes = collectImplementedRestRoutes();

const missingRestRoutes = [...documentedRestRoutes]
  .filter(isDocumentedRestRouteChecked)
  .filter((route) => !implementedRestRoutes.has(route))
  .sort();

const undocumentedRestRoutes = [...implementedRestRoutes]
  .filter((route) => !documentedRestRoutes.has(route))
  .filter((route) => !isImplementedRestRouteIgnored(route))
  .sort();

if (missingRestRoutes.length > 0 || undocumentedRestRoutes.length > 0) {
  console.error("Feature document REST route parity check failed:");
  for (const route of missingRestRoutes) {
    console.error(`- documented but not implemented: ${route}`);
  }
  for (const route of undocumentedRestRoutes) {
    console.error(`- implemented but not documented: ${route}`);
  }
  process.exit(1);
}

const documentedMcpTools = collectDocumentedMcpTools(merged.modules);
const implementedMcpTools = collectImplementedMcpTools();

const missingMcpTools = [...documentedMcpTools]
  .filter((tool) => !implementedMcpTools.has(tool))
  .sort();

const undocumentedMcpTools = [...implementedMcpTools]
  .filter((tool) => !documentedMcpTools.has(tool))
  .sort();

if (missingMcpTools.length > 0 || undocumentedMcpTools.length > 0) {
  console.error("Feature document MCP tool parity check failed:");
  for (const tool of missingMcpTools) {
    console.error(`- documented but not implemented: ${tool}`);
  }
  for (const tool of undocumentedMcpTools) {
    console.error(`- implemented but not documented: ${tool}`);
  }
  process.exit(1);
}

console.log("✅ Features validate against schema, Prisma, REST, and MCP");
console.log(`   ${files.length} files merged successfully`);
