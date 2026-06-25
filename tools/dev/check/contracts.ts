import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import {
  getExportedRouteMethods,
  type HttpMethod,
} from "../../shared/route-exports";
import { fail, reportUnexpectedError, walkFiles } from "./common";

function checkContractsDoc() {
  const contractsDir = "docs/contracts";
  const schemaPath = "docs/contracts.schema.json";
  const prismaPath = "prisma/schema.prisma";
  const restRouteRoots = ["src/routes/api", "src/routes/.well-known"];
  const mcpDir = "src/lib/mcp/tools";

  type PrismaDocs = {
    enums: Record<string, string[]>;
    models: Record<
      string,
      { fields: Record<string, string>; constraints?: string[] }
    >;
  };

  type ContractDoc = {
    capabilities?: Record<
      string,
      {
        auth?: ContractAuthLevel;
        rest?:
          | "stable"
          | "planned"
          | "unavailable"
          | {
              status?: string;
              routes?: ContractRouteEntry[];
            };
        mcp?:
          | "stable"
          | "planned"
          | "unavailable"
          | {
              status?: string;
              tools?: Array<string | { name?: string; status?: string }>;
              groups?: Array<{ tools?: string[] }>;
            };
      }
    >;
  };

  type ContractAuthLevel = "anon" | "user" | "admin" | "internal";

  type ContractRouteEntry = {
    path: string;
    method?: string;
    auth?: ContractAuthLevel;
    returns?: string;
    notes?: string[];
    reference_only?: boolean;
  };

  type DocumentedRestRoute = {
    key: string;
    method: string;
    path: string;
    auth: ContractAuthLevel;
    moduleName: string;
    capabilityName: string;
    route: ContractRouteEntry;
  };

  type OpenApiOperation = {
    security?: unknown;
    "x-auth-role"?: unknown;
  };

  type OpenApiDocument = {
    paths?: Record<string, Record<string, OpenApiOperation | undefined>>;
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
    const contractMethods = [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
    ] as const satisfies readonly HttpMethod[];
    const routes = new Set<string>();

    for (const routeRoot of restRouteRoots) {
      for (const file of walkFiles(routeRoot).filter((item) =>
        item.endsWith("/+server.ts"),
      )) {
        const source = readFileSync(file, "utf8");
        const routePath = parseImplementedRoutePath(file);
        for (const method of getExportedRouteMethods(source, contractMethods)) {
          routes.add(`${method} ${routePath}`);
        }
      }
    }

    return routes;
  }

  function collectDocumentedRestRoutes(
    modules: Record<string, unknown>,
  ): DocumentedRestRoute[] {
    const routes: DocumentedRestRoute[] = [];

    for (const [moduleName, moduleDoc] of Object.entries(modules) as Array<
      [string, ContractDoc]
    >) {
      for (const [capabilityName, capability] of Object.entries(
        moduleDoc.capabilities ?? {},
      )) {
        if (!capability || typeof capability !== "object") continue;
        if (!capability.rest || typeof capability.rest !== "object") continue;
        const capabilityAuth = capability.auth ?? "anon";
        for (const route of capability.rest.routes ?? []) {
          const method = route.method ?? "GET";
          const key = `${method} ${route.path}`;
          routes.push({
            key,
            method,
            path: route.path,
            auth: route.auth ?? capabilityAuth,
            moduleName,
            capabilityName,
            route,
          });
        }
      }
    }

    return routes;
  }

  function formatRestOwner(route: DocumentedRestRoute): string {
    return `${route.moduleName}.${route.capabilityName}`;
  }

  function checkDuplicateRestRouteOwnership(routes: DocumentedRestRoute[]) {
    const routeGroups = new Map<string, DocumentedRestRoute[]>();
    const duplicateErrors: string[] = [];
    const referenceOnlyShapeErrors: string[] = [];

    for (const route of routes) {
      const group = routeGroups.get(route.key) ?? [];
      group.push(route);
      routeGroups.set(route.key, group);

      if (route.route.reference_only !== true) continue;
      const disallowedReferenceFields = [
        "auth",
        "description",
        "returns",
        "content_type",
        "status",
        "notes",
      ];
      const disallowedFields = disallowedReferenceFields.filter(
        (field) => field in route.route,
      );
      if (disallowedFields.length > 0) {
        referenceOnlyShapeErrors.push(
          `${route.key} in ${formatRestOwner(route)} has reference_only with ${disallowedFields.join(", ")}`,
        );
      }
    }

    for (const [routeKey, group] of routeGroups) {
      const canonicalOwners = group.filter(
        (route) => route.route.reference_only !== true,
      );
      const hasReferenceOnly = group.some(
        (route) => route.route.reference_only === true,
      );

      if (hasReferenceOnly && canonicalOwners.length === 0) {
        duplicateErrors.push(
          `${routeKey} has only reference-only contract entries: ${group.map(formatRestOwner).join(", ")}`,
        );
        continue;
      }

      if (group.length > 1 && canonicalOwners.length !== 1) {
        duplicateErrors.push(
          `${routeKey} has ${canonicalOwners.length} canonical owners: ${canonicalOwners.map(formatRestOwner).join(", ")}`,
        );
      }
    }

    if (referenceOnlyShapeErrors.length > 0 || duplicateErrors.length > 0) {
      console.error("Contract REST duplicate ownership check failed:");
      for (const error of referenceOnlyShapeErrors) {
        console.error(`- ${error}`);
      }
      for (const error of duplicateErrors) {
        console.error(`- ${error}`);
      }
      process.exit(1);
    }
  }

  function contractPathToOpenApiPath(routePath: string) {
    return routePath
      .replace(/\[\.\.\.([^\]]+)\]/g, "{$1}")
      .replace(/\[([^\]]+)\]/g, "{$1}");
  }

  function expectedOpenApiSecurity(route: DocumentedRestRoute) {
    const openApiPath = contractPathToOpenApiPath(route.path);
    const method = route.method.toLowerCase();

    if (openApiPath === "/api/mcp" && route.auth === "user") {
      return [{ mcpBearerAuth: [] }];
    }

    if (
      openApiPath === "/api/users/{userId}/calendar.ics" &&
      method === "get" &&
      route.auth === "user"
    ) {
      return [
        { bearerAuth: [] },
        { sessionCookie: [] },
        { calendarFeedToken: [] },
      ];
    }

    if (route.auth === "internal") {
      return [{ internalBearerAuth: [] }];
    }

    if (route.auth === "admin") {
      return [{ sessionCookie: [] }];
    }

    if (route.auth === "user") {
      return [{ bearerAuth: [] }, { sessionCookie: [] }];
    }

    return undefined;
  }

  function expectedOpenApiAuthRole(route: DocumentedRestRoute) {
    return route.auth === "admin" ? "admin" : undefined;
  }

  function readGeneratedOpenApiSpec(): OpenApiDocument {
    return JSON.parse(
      readFileSync("public/openapi.generated.json", "utf8"),
    ) as OpenApiDocument;
  }

  function checkOpenApiSecurityParity(routes: DocumentedRestRoute[]) {
    const spec = readGeneratedOpenApiSpec();
    const errors: string[] = [];

    for (const route of routes) {
      if (route.route.reference_only === true) continue;
      const openApiPath = contractPathToOpenApiPath(route.path);
      const method = route.method.toLowerCase();
      const operation = spec.paths?.[openApiPath]?.[method];
      if (!operation) continue;

      const expectedSecurity = expectedOpenApiSecurity(route);
      const actualSecurity = operation.security;
      if (JSON.stringify(actualSecurity) !== JSON.stringify(expectedSecurity)) {
        errors.push(
          `${route.method} ${route.path} (${formatRestOwner(route)}) expected OpenAPI security ${JSON.stringify(expectedSecurity ?? null)}, got ${JSON.stringify(actualSecurity ?? null)}`,
        );
      }

      const expectedAuthRole = expectedOpenApiAuthRole(route);
      const actualAuthRole = operation["x-auth-role"];
      if (actualAuthRole !== expectedAuthRole) {
        errors.push(
          `${route.method} ${route.path} (${formatRestOwner(route)}) expected OpenAPI x-auth-role ${JSON.stringify(expectedAuthRole ?? null)}, got ${JSON.stringify(actualAuthRole ?? null)}`,
        );
      }
    }

    if (errors.length > 0) {
      console.error("Contract/OpenAPI auth security parity check failed:");
      for (const error of errors) {
        console.error(`- ${error}`);
      }
      process.exit(1);
    }
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

    for (const moduleDoc of Object.values(modules) as ContractDoc[]) {
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
        for (const group of capability.mcp.groups ?? []) {
          for (const tool of group.tools ?? []) {
            tools.add(tool);
          }
        }
      }
    }

    return tools;
  }

  function collectDocumentedModelLinks(
    modules: Record<string, unknown>,
  ): Set<string> {
    const models = new Set<string>();

    function addModelRef(ref: unknown) {
      if (typeof ref === "string") {
        models.add(ref);
        return;
      }
      if (ref && typeof ref === "object" && "name" in ref) {
        const name = (ref as { name?: unknown }).name;
        if (typeof name === "string") models.add(name);
      }
    }

    for (const moduleDoc of Object.values(modules) as Array<{
      links?: { models?: unknown[] };
      capabilities?: Record<string, { links?: { models?: unknown[] } }>;
    }>) {
      for (const ref of moduleDoc.links?.models ?? []) addModelRef(ref);
      for (const capability of Object.values(moduleDoc.capabilities ?? {})) {
        for (const ref of capability.links?.models ?? []) addModelRef(ref);
      }
    }

    return models;
  }

  function collectDocumentedAuditActions(audit: unknown): Set<string> {
    if (!audit || typeof audit !== "object" || !("actions" in audit)) {
      return new Set();
    }

    const actions = (audit as { actions?: unknown }).actions;
    if (!actions || typeof actions !== "object" || Array.isArray(actions)) {
      return new Set();
    }

    return new Set(Object.keys(actions));
  }

  function isDocumentedRestRouteChecked(route: string): boolean {
    const [, routePath] = route.split(" ", 2);
    return (
      routePath.startsWith("/api/") || routePath.startsWith("/.well-known/")
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

  if (!existsSync(contractsDir)) {
    fail(`Contracts directory not found: ${contractsDir}`);
  }

  const files = readdirSync(contractsDir).filter((file) =>
    file.endsWith(".json"),
  );
  if (files.length === 0) {
    fail("No contract files found");
  }

  const metadataTargets = {
    "_meta.json": "meta",
    "_product.json": "product",
    "_ui.json": "ui",
    "_cases.json": "cases",
    "_audit.json": "audit",
  } as const;

  const merged: Record<string, unknown> & {
    modules: Record<string, unknown>;
  } = {
    meta: {},
    product: {},
    ui: {},
    modules: {},
    cases: {},
    audit: {},
  };

  for (const file of files.sort()) {
    const contractPath = join(contractsDir, file);
    const content = readFileSync(contractPath, "utf8");
    const data = JSON.parse(content);

    if (file.startsWith("_")) {
      const target = metadataTargets[file as keyof typeof metadataTargets];
      if (!target) {
        fail(`Unknown metadata file: ${contractPath}`);
      }
      merged[target] = data;
      continue;
    }

    const moduleName = file.replace(".json", "");
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      fail(`Module file must contain a JSON object: ${contractPath}`);
    }
    merged.modules[moduleName] = data;
  }

  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);

  if (!validate(merged)) {
    console.error("Contract schema validation failed:");
    for (const error of validate.errors ?? []) {
      console.error(
        `- ${error.instancePath || "/"} ${error.message ?? "is invalid"}`,
      );
    }
    process.exit(1);
  }

  const prismaDocs = parsePrismaSchema(readFileSync(prismaPath, "utf8"));
  const documentedModelLinks = collectDocumentedModelLinks(merged.modules);
  const unknownModelLinks = [...documentedModelLinks]
    .filter((model) => !(model in prismaDocs.models))
    .sort();

  if (unknownModelLinks.length > 0) {
    console.error("Contract model links are not in prisma/schema.prisma:");
    for (const model of unknownModelLinks) {
      console.error(`- ${model}`);
    }
    process.exit(1);
  }

  const documentedAuditActions = collectDocumentedAuditActions(merged.audit);
  const prismaAuditActions = new Set(prismaDocs.enums.AuditAction ?? []);
  const missingAuditActions = [...prismaAuditActions]
    .filter((action) => !documentedAuditActions.has(action))
    .sort();
  const unknownAuditActions = [...documentedAuditActions]
    .filter((action) => !prismaAuditActions.has(action))
    .sort();

  if (missingAuditActions.length > 0 || unknownAuditActions.length > 0) {
    console.error("Contract audit actions do not match AuditAction:");
    for (const action of missingAuditActions) {
      console.error(`- enum value not documented: ${action}`);
    }
    for (const action of unknownAuditActions) {
      console.error(`- documented but not in enum: ${action}`);
    }
    process.exit(1);
  }

  const documentedRestRoutes = collectDocumentedRestRoutes(merged.modules);
  checkDuplicateRestRouteOwnership(documentedRestRoutes);
  checkOpenApiSecurityParity(documentedRestRoutes);

  const documentedRestRouteKeys = new Set(
    documentedRestRoutes.map((route) => route.key),
  );
  const implementedRestRoutes = collectImplementedRestRoutes();

  const missingRestRoutes = [...documentedRestRouteKeys]
    .filter(isDocumentedRestRouteChecked)
    .filter((route) => !implementedRestRoutes.has(route))
    .sort();

  const undocumentedRestRoutes = [...implementedRestRoutes]
    .filter((route) => !documentedRestRouteKeys.has(route))
    .filter((route) => !isImplementedRestRouteIgnored(route))
    .sort();

  if (missingRestRoutes.length > 0 || undocumentedRestRoutes.length > 0) {
    console.error("Contract REST route parity check failed:");
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
    console.error("Contract MCP tool parity check failed:");
    for (const tool of missingMcpTools) {
      console.error(`- documented but not implemented: ${tool}`);
    }
    for (const tool of undocumentedMcpTools) {
      console.error(`- implemented but not documented: ${tool}`);
    }
    process.exit(1);
  }
}

try {
  checkContractsDoc();
} catch (error: unknown) {
  reportUnexpectedError(error);
}
