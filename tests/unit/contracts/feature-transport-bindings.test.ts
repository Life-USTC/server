import { fileURLToPath } from "node:url";
import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import { readFeatureSpecifications } from "../../../scripts/specifications/repository";

type FeatureSpecification = {
  id: string;
  capabilities: Record<
    string,
    {
      graphql?:
        | string
        | {
            queries?: {
              name: string;
              rest_equivalent?: string;
              status?: string;
            }[];
            mutations?: {
              name: string;
              rest_equivalent?: string;
              status?: string;
            }[];
            fields?: {
              name: string;
              rest_equivalent?: string;
              status?: string;
            }[];
          };
      rest?:
        | string
        | {
            routes?: {
              path: string;
              method?: string;
              status?: number | "stable" | "planned" | "unavailable";
            }[];
          };
    }
  >;
};

const root = fileURLToPath(new URL("../../../", import.meta.url));

describe("feature transport bindings", () => {
  it("binds every declared REST operation to an exported route handler", async () => {
    const features = await readFeatureSpecifications<FeatureSpecification>();
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      skipLoadingLibFiles: true,
      compilerOptions: { noResolve: true },
    });
    // Include metadata routes in dot-directories as well as the ordinary API.
    project.addSourceFilesAtPaths([
      `${root}src/routes/api/**/+server.ts`,
      `${root}src/routes/.well-known/**/+server.ts`,
      `${root}src/routes/api/**/.well-known/**/+server.ts`,
    ]);
    const operations = new Set<string>();
    for (const file of project.getSourceFiles()) {
      const path = file
        .getFilePath()
        .replace(`${root}src/routes`, "")
        .replace(/\/\+server\.ts$/, "")
        .replace(/\[+\.{0,3}([^\]]+?)\]+/g, "{$1}");
      for (const name of file.getExportedDeclarations().keys()) {
        if (
          ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"].includes(
            name,
          )
        ) {
          operations.add(`${name} ${path}`);
        }
      }
    }
    let checked = 0;
    for (const feature of features) {
      for (const [id, capability] of Object.entries(feature.capabilities)) {
        const routes =
          typeof capability.rest === "object" && capability.rest
            ? (capability.rest.routes ?? [])
            : [];
        for (const route of routes) {
          if (route.status === "planned" || route.status === "unavailable")
            continue;
          const path = route.path.replace(/\[([^\]]+)\]/g, "{$1}");
          const operation = `${route.method ?? "GET"} ${path}`;
          expect(
            operations.has(operation),
            `${feature.id}.${id}: missing ${operation}`,
          ).toBe(true);
          checked += 1;
        }
        const graphql = capability.graphql;
        if (typeof graphql !== "object" || !graphql) continue;
        for (const field of [
          ...(graphql.queries ?? []),
          ...(graphql.mutations ?? []),
          ...(graphql.fields ?? []),
        ]) {
          if (
            field.status === "planned" ||
            field.status === "unavailable" ||
            !field.rest_equivalent
          )
            continue;
          const operation = field.rest_equivalent
            .replace(/\[([^\]]+)\]/g, "{$1}")
            .replace(/:([A-Za-z][A-Za-z0-9_]*)/g, "{$1}");
          expect(
            operations.has(operation),
            `${feature.id}.${id}.${field.name}: missing ${operation}`,
          ).toBe(true);
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});
