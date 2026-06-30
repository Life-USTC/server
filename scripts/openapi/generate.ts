import * as fs from "node:fs";
import * as path from "node:path";
import { Project } from "ts-morph";
import {
  createDocument,
  type OpenAPIObject,
  type ZodOpenApiPathsObject,
} from "zod-openapi";
import baseDoc from "../../svelte.openapi.json";

const ROUTES_GLOB = "src/routes/api/**/+server.ts";
const SCHEMA_MODULES = [
  "src/lib/api/schemas/request-schemas.ts",
  "src/lib/api/schemas/response-schemas.ts",
];

export function generateOpenApiDocument(): OpenAPIObject {
  const project = new Project({ tsConfigFilePath: "tsconfig.json" });
  registerSchemas();
  const paths = collectPaths(project);
  return createDocument({
    ...baseDoc,
    paths,
  });
}

function registerSchemas() {
  // Task 2: import SCHEMA_MODULES so zod-openapi can collect component schemas.
  void SCHEMA_MODULES;
}

function collectPaths(project: Project): ZodOpenApiPathsObject {
  const paths: ZodOpenApiPathsObject = {};
  for (const sourceFile of project.getSourceFiles(ROUTES_GLOB)) {
    // Task 2: parse JSDoc tags and build path items.
    void sourceFile;
  }
  return paths;
}

if (import.meta.main) {
  const doc = generateOpenApiDocument();
  const out = path.resolve("public/openapi.generated.json");
  fs.writeFileSync(out, `${JSON.stringify(doc, null, 2)}\n`);
  console.log(`Wrote ${out}`);
}
