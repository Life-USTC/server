import "dotenv/config";

import type { Dirent } from "node:fs";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { join, relative } from "node:path";
import Ajv2020 from "ajv/dist/2020";

const repoRoot = process.cwd();

function walkFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      return walkFiles(fullPath);
    }
    if (entry.isFile()) {
      return [fullPath];
    }
    return [];
  });
}

type CheckMode = "e2e" | "features" | "i18n" | "routes";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function requireMode(value: string | undefined): CheckMode {
  const modes = new Set<CheckMode>(["e2e", "features", "i18n", "routes"]);

  if (value && modes.has(value as CheckMode)) {
    return value as CheckMode;
  }

  fail(
    [
      "Usage: bun run tools/dev/check.ts <mode> [options]",
      "",
      "Modes:",
      "  e2e",
      "  features",
      "  i18n",
      "  routes",
    ].join("\n"),
  );
}

function checkE2eConventions() {
  type Violation = {
    file: string;
    rule: string;
    line: number;
  };

  const e2eRoot = join(repoRoot, "tests/e2e");
  const prismaFixtureRoot = join(e2eRoot, "utils/e2e-db");
  const violations: Violation[] = [];

  function addViolation(file: string, rule: string, line: number) {
    violations.push({
      file: file.replace(`${repoRoot}/`, ""),
      rule,
      line,
    });
  }

  for (const file of walkFiles(e2eRoot)) {
    if (!/\.(ts|tsx)$/.test(file)) {
      continue;
    }

    const source = readFileSync(file, "utf8");
    const lines = source.split("\n");

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      if (line.includes("waitForTimeout(")) {
        addViolation(file, "Do not use waitForTimeout()", lineNumber);
      }
      if (line.includes("test.skip(") || line.includes(".skip(")) {
        addViolation(file, "Do not commit skipped e2e tests", lineNumber);
      }
      if (
        line.includes('from "@/lib/db/prisma"') &&
        !file.startsWith(prismaFixtureRoot)
      ) {
        addViolation(
          file,
          "Do not import Prisma directly in Playwright tests; use tests/e2e/utils/e2e-db helpers",
          lineNumber,
        );
      }
    });
  }

  if (violations.length > 0) {
    console.error("E2E convention check failed:\n");
    for (const violation of violations) {
      console.error(`${violation.file}:${violation.line} ${violation.rule}`);
    }
    process.exit(1);
  }

  console.log(
    `E2E convention check passed for ${statSync(e2eRoot).isDirectory() ? "tests/e2e" : "unknown"}.`,
  );
}

function checkFeaturesDoc() {
  const featuresDir = "docs/features";
  const schemaPath = "docs/features.schema.json";
  const prismaPath = "prisma/schema.prisma";
  const apiDir = "src/routes/api";
  const mcpDir = "src/lib/mcp/tools";

  type PrismaDocs = {
    enums: Record<string, string[]>;
    models: Record<
      string,
      { fields: Record<string, string>; constraints?: string[] }
    >;
  };

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

  function parseImplementedRoutePath(filePath: string): string {
    const routePath = relative("src/routes", filePath)
      .replace(/\\/g, "/")
      .replace(/\/\+server\.ts$/, "");

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
      /export\s+(?:async\s+function\s+|const\s+)(GET|POST|PUT|PATCH|DELETE)\b/g;
    const routes = new Set<string>();

    for (const file of walkFiles(apiDir).filter((item) =>
      item.endsWith("/+server.ts"),
    )) {
      const source = readFileSync(file, "utf8");
      const routePath = parseImplementedRoutePath(file);
      for (const match of source.matchAll(methodPattern)) {
        routes.add(`${match[1]} ${routePath}`);
      }
    }

    return routes;
  }

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

    for (const file of walkFiles(mcpDir).filter((item) =>
      item.endsWith(".ts"),
    )) {
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
    const [, routePath] = route.split(" ", 2);
    return (
      routePath.startsWith("/api/") && !routePath.includes("/.well-known/")
    );
  }

  function isImplementedRestRouteIgnored(route: string): boolean {
    return (
      route === "GET /api/auth/{auth}" ||
      route === "PATCH /api/auth/{auth}" ||
      route === "PUT /api/auth/{auth}" ||
      route === "DELETE /api/auth/{auth}"
    );
  }

  if (!existsSync(featuresDir)) {
    fail(`Features directory not found: ${featuresDir}`);
  }

  const files = readdirSync(featuresDir).filter((file) =>
    file.endsWith(".json"),
  );
  if (files.length === 0) {
    fail("No feature files found");
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

  const merged: Record<string, unknown> & {
    modules: Record<string, unknown>;
  } = {
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
    const featurePath = join(featuresDir, file);
    const content = readFileSync(featurePath, "utf8");
    const data = JSON.parse(content);

    if (file.startsWith("_")) {
      const target = metadataTargets[file as keyof typeof metadataTargets];
      if (!target) {
        fail(`Unknown metadata file: ${featurePath}`);
      }
      merged[target] = data;
      continue;
    }

    const moduleName = file.replace(".json", "");
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      fail(`Module file must contain a JSON object: ${featurePath}`);
    }
    merged.modules[moduleName] = data;
  }

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

  const expected = parsePrismaSchema(readFileSync(prismaPath, "utf8"));
  const actual = { enums: merged.enums, models: merged.models };

  if (stableJson(actual) !== stableJson(expected)) {
    fail(
      "Feature document model metadata is out of sync with prisma/schema.prisma.",
    );
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
}

function checkI18nKeys() {
  type Locale = "en-us" | "zh-cn";

  type Binding = {
    namespace: string | null;
    file: string;
  };

  type BindingOccurrence = Binding & { pos: number };

  const srcRoot = join(repoRoot, "src");
  const messagesRoot = join(repoRoot, "messages");

  function readJson(filePath: string): unknown {
    return JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  }

  function hasPath(root: unknown, keyPath: string[]): boolean {
    let cur: unknown = root;
    for (const part of keyPath) {
      if (
        cur &&
        typeof cur === "object" &&
        part in (cur as Record<string, unknown>)
      ) {
        cur = (cur as Record<string, unknown>)[part];
        continue;
      }
      return false;
    }
    return true;
  }

  function normalizeKey(namespace: string | null, key: string): string {
    if (!namespace) return key;
    return `${namespace}.${key}`;
  }

  function splitTopLevelCommaList(input: string): string[] {
    const parts: string[] = [];
    let buf = "";
    let depthParen = 0;
    let depthBracket = 0;
    let depthBrace = 0;
    let inSingle = false;
    let inDouble = false;
    let inTemplate = false;
    let isEscaped = false;

    for (let index = 0; index < input.length; index++) {
      const ch = input[index] ?? "";
      if (isEscaped) {
        buf += ch;
        isEscaped = false;
        continue;
      }
      if (ch === "\\") {
        buf += ch;
        isEscaped = true;
        continue;
      }

      if (!inDouble && !inTemplate && ch === "'") {
        inSingle = !inSingle;
        buf += ch;
        continue;
      }
      if (!inSingle && !inTemplate && ch === '"') {
        inDouble = !inDouble;
        buf += ch;
        continue;
      }
      if (!inSingle && !inDouble && ch === "`") {
        inTemplate = !inTemplate;
        buf += ch;
        continue;
      }

      if (inSingle || inDouble || inTemplate) {
        buf += ch;
        continue;
      }

      if (ch === "(") depthParen++;
      else if (ch === ")") depthParen = Math.max(0, depthParen - 1);
      else if (ch === "[") depthBracket++;
      else if (ch === "]") depthBracket = Math.max(0, depthBracket - 1);
      else if (ch === "{") depthBrace++;
      else if (ch === "}") depthBrace = Math.max(0, depthBrace - 1);

      if (
        ch === "," &&
        depthParen === 0 &&
        depthBracket === 0 &&
        depthBrace === 0
      ) {
        const trimmed = buf.trim();
        if (trimmed.length > 0) parts.push(trimmed);
        buf = "";
        continue;
      }

      buf += ch;
    }

    const trimmed = buf.trim();
    if (trimmed.length > 0) parts.push(trimmed);
    return parts;
  }

  function extractBindings(
    source: string,
    file: string,
  ): Map<string, BindingOccurrence[]> {
    const bindings = new Map<string, BindingOccurrence[]>();
    const patterns: Array<{
      regex: RegExp;
      namespaceGroup: number;
      varGroup: number;
    }> = [
      {
        regex:
          /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*useTranslations\s*\(\s*["']([^"']+)["']\s*\)/g,
        varGroup: 1,
        namespaceGroup: 2,
      },
      {
        regex:
          /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*await\s+getTranslations\s*\(\s*["']([^"']+)["']\s*\)/g,
        varGroup: 1,
        namespaceGroup: 2,
      },
      {
        regex:
          /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*getTranslations\s*\(\s*["']([^"']+)["']\s*\)/g,
        varGroup: 1,
        namespaceGroup: 2,
      },
    ];

    for (const { regex, namespaceGroup, varGroup } of patterns) {
      for (const match of source.matchAll(regex)) {
        const varName = match[varGroup];
        const namespace = match[namespaceGroup] ?? null;
        if (!varName) continue;
        const pos = match.index ?? 0;
        const list = bindings.get(varName) ?? [];
        list.push({ namespace, file, pos });
        bindings.set(varName, list);
      }
    }

    const promiseAllRegex =
      /\bconst\s+\[([\s\S]*?)\]\s*=\s*await\s+Promise\.all\s*\(\s*\[([\s\S]*?)\]\s*\)/g;
    for (const match of source.matchAll(promiseAllRegex)) {
      const basePos = match.index ?? 0;
      const varsRaw = match[1] ?? "";
      const exprsRaw = match[2] ?? "";
      const vars = splitTopLevelCommaList(varsRaw);
      const exprs = splitTopLevelCommaList(exprsRaw);
      const len = Math.min(vars.length, exprs.length);
      for (let index = 0; index < len; index++) {
        const varToken = vars[index]?.trim();
        const exprToken = exprs[index]?.trim();
        if (!varToken || !exprToken) continue;
        if (!/^[A-Za-z_$][\w$]*$/.test(varToken)) continue;
        const translationMatch = exprToken.match(
          /\bgetTranslations\s*\(\s*["']([^"']+)["']\s*\)/,
        );
        if (!translationMatch?.[1]) continue;
        const list = bindings.get(varToken) ?? [];
        list.push({ namespace: translationMatch[1], file, pos: basePos });
        bindings.set(varToken, list);
      }
    }

    return bindings;
  }

  function extractKeysFromFile(filePath: string): Set<string> {
    const source = readFileSync(filePath, "utf8");
    const bindings = extractBindings(source, filePath);
    const keys = new Set<string>();

    for (const [varName, occurrences] of bindings) {
      const sorted = occurrences.toSorted((a, b) => a.pos - b.pos);
      const callRegex = new RegExp(
        String.raw`\b${varName}\s*\(\s*["']([^"']+)["']\s*[,)]`,
        "g",
      );
      const richRegex = new RegExp(
        String.raw`\b${varName}\s*\.rich\s*\(\s*["']([^"']+)["']\s*[,)]`,
        "g",
      );
      function resolveNamespace(pos: number): string | null {
        let namespace: string | null = null;
        for (const occurrence of sorted) {
          if (occurrence.pos <= pos) namespace = occurrence.namespace;
          else break;
        }
        return namespace;
      }

      for (const match of source.matchAll(callRegex)) {
        const key = match[1];
        if (!key) continue;
        const namespace = resolveNamespace(match.index ?? 0);
        if (!namespace) continue;
        keys.add(normalizeKey(namespace, key));
      }
      for (const match of source.matchAll(richRegex)) {
        const key = match[1];
        if (!key) continue;
        const namespace = resolveNamespace(match.index ?? 0);
        if (!namespace) continue;
        keys.add(normalizeKey(namespace, key));
      }
    }

    const inlineUseTranslationsRegex =
      /\buseTranslations\s*\(\s*["']([^"']+)["']\s*\)\s*\(\s*["']([^"']+)["']\s*[,)]/g;
    for (const match of source.matchAll(inlineUseTranslationsRegex)) {
      const namespace = match[1];
      const key = match[2];
      if (!namespace || !key) continue;
      keys.add(normalizeKey(namespace, key));
    }

    const inlineGetTranslationsRegex =
      /\bgetTranslations\s*\(\s*["']([^"']+)["']\s*\)\s*\(\s*["']([^"']+)["']\s*[,)]/g;
    for (const match of source.matchAll(inlineGetTranslationsRegex)) {
      const namespace = match[1];
      const key = match[2];
      if (!namespace || !key) continue;
      keys.add(normalizeKey(namespace, key));
    }

    return keys;
  }

  const files = walkFiles(srcRoot).filter((item) =>
    /\.(svelte|ts|tsx)$/.test(item),
  );
  const usedKeys = new Set<string>();

  for (const file of files) {
    for (const key of extractKeysFromFile(file)) {
      usedKeys.add(key);
    }
  }

  const locales: Locale[] = ["en-us", "zh-cn"];
  const messageTrees = new Map<Locale, unknown>(
    locales.map((locale) => [
      locale,
      readJson(join(messagesRoot, `${locale}.json`)),
    ]),
  );

  const missingByLocale = new Map<Locale, string[]>(
    locales.map((locale) => [locale, []]),
  );

  for (const key of Array.from(usedKeys).sort()) {
    const keyPath = key.split(".").filter(Boolean);
    for (const locale of locales) {
      const tree = messageTrees.get(locale);
      if (!hasPath(tree, keyPath)) {
        missingByLocale.get(locale)?.push(key);
      }
    }
  }

  let hasMissing = false;
  for (const locale of locales) {
    const missing = missingByLocale.get(locale) ?? [];
    if (missing.length === 0) continue;
    hasMissing = true;
    console.error(`\nMissing messages in ${locale} (${missing.length}):`);
    for (const key of missing) console.error(`- ${key}`);
  }

  if (hasMissing) {
    process.exit(1);
  }

  console.log(
    `i18n key check passed. Scanned ${files.length} files, ${usedKeys.size} keys.`,
  );
}

async function checkRouteConventions() {
  const routeRoots = ["src/routes/api", "src/routes/.well-known"];
  const jsonHelperAllowlist = new Set([
    "src/routes/api/auth/.well-known/openid-configuration/+server.ts",
    "src/routes/api/auth/[...auth]/+server.ts",
    "src/routes/api/auth/oauth2/device-authorization/+server.ts",
    "src/routes/api/auth/oauth2/token/+server.ts",
    "src/routes/api/dashboard-links/pin/+server.ts",
    "src/routes/api/dashboard-links/visit/+server.ts",
    "src/routes/api/health/+server.ts",
    "src/routes/api/mcp/+server.ts",
    "src/routes/api/mcp/.well-known/oauth-authorization-server/+server.ts",
    "src/routes/api/mcp/.well-known/openid-configuration/+server.ts",
    "src/routes/api/metrics/+server.ts",
    "src/routes/api/sections/[jwId]/calendar.ics/+server.ts",
    "src/routes/api/sections/calendar.ics/+server.ts",
    "src/routes/api/uploads/[id]/download/+server.ts",
    "src/routes/api/users/[userId]/calendar.ics/+server.ts",
    "src/routes/.well-known/oauth-authorization-server/+server.ts",
    "src/routes/.well-known/oauth-authorization-server/api/auth/+server.ts",
    "src/routes/.well-known/oauth-authorization-server/api/mcp/+server.ts",
    "src/routes/.well-known/oauth-protected-resource/+server.ts",
    "src/routes/.well-known/oauth-protected-resource/api/mcp/+server.ts",
    "src/routes/.well-known/openid-configuration/+server.ts",
    "src/routes/.well-known/openid-configuration/api/auth/+server.ts",
    "src/routes/.well-known/openid-configuration/api/mcp/+server.ts",
  ]);

  async function collectRouteFiles(relativeDir: string): Promise<string[]> {
    const absoluteDir = path.join(repoRoot, relativeDir);
    let entries: Dirent[] = [];

    try {
      entries = await fs.readdir(absoluteDir, { withFileTypes: true });
    } catch {
      return [];
    }

    const results = await Promise.all(
      entries.map(async (entry) => {
        const relativePath = path.join(relativeDir, entry.name);
        if (entry.isDirectory()) {
          return collectRouteFiles(relativePath);
        }
        if (entry.isFile() && entry.name === "+server.ts") {
          return [relativePath];
        }
        return [];
      }),
    );

    return results.flat();
  }

  function usesJsonHelpers(source: string) {
    return (
      source.includes("jsonResponse(") ||
      source.includes("handleRouteError(") ||
      source.includes('from "@/lib/api/routes/') ||
      source.includes('from "@/lib/api/svelte-route"') ||
      source.includes("createOAuthDiscoveryRoute(") ||
      source.includes("createDiscoveryMetadataRoute(") ||
      source.includes("createDiscoveryRedirectRoute(") ||
      source.includes("getDiscoveryRedirectResponse(") ||
      source.includes("getDiscoveryOptionsResponse(")
    );
  }

  const routeFiles = (
    await Promise.all(
      routeRoots.map((relativeDir) => collectRouteFiles(relativeDir)),
    )
  )
    .flat()
    .sort();

  const issues: string[] = [];

  for (const relativePath of routeFiles) {
    const source = await fs.readFile(path.join(repoRoot, relativePath), "utf8");

    if (!jsonHelperAllowlist.has(relativePath) && !usesJsonHelpers(source)) {
      issues.push(`missing json helper usage: ${relativePath}`);
    }
  }

  if (issues.length > 0) {
    console.error("Route convention check failed:\n");
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exit(1);
  }

  console.log(`Checked ${routeFiles.length} route handlers`);
}

async function main() {
  const mode = requireMode(process.argv[2]);

  try {
    switch (mode) {
      case "e2e":
        checkE2eConventions();
        break;
      case "features":
        checkFeaturesDoc();
        break;
      case "i18n":
        checkI18nKeys();
        break;
      case "routes":
        await checkRouteConventions();
        break;
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? (error.stack ?? error.message) : String(error);
    console.error(message);
    process.exit(1);
  }
}

await main();
