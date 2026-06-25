import * as fs from "node:fs/promises";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

async function collectSourceFiles(rootDir: string): Promise<string[]> {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(rootDir, entry.name);
      if (entry.isDirectory()) {
        return collectSourceFiles(entryPath);
      }
      if (entry.isFile() && /\.(svelte|ts|tsx)$/.test(entry.name)) {
        return [entryPath];
      }
      return [];
    }),
  );

  return files.flat();
}

function importSpecifiers(source: string) {
  return Array.from(
    source.matchAll(
      /\b(?:import\s*(?:type\s*)?(?:[^"']*?\s+from\s*)?|export\s*(?:type\s*)?[^"']*?\s+from\s*|import\s*\(\s*)(["'])(@\/[^"']+)\1/g,
    ),
    (match) => match[2],
  );
}

function relativeSourcePath(filePath: string) {
  return path.relative(process.cwd(), filePath).replace(/\\/g, "/");
}

function featureImports(source: string) {
  return importSpecifiers(source).filter((specifier) =>
    specifier.startsWith("@/features/"),
  );
}

const routeAdapterPrefix = "src/lib/api/routes/";
const maxRouteAdapterFeatureImportFiles = 58;
const maxRouteAdapterFeatureImports = 90;

const libFeatureImportAllowedPrefixes = [
  routeAdapterPrefix,
  "src/lib/api/schemas/",
  "src/lib/mcp/",
];

function isAllowedLibFeatureAdapter(filePath: string) {
  const relativePath = relativeSourcePath(filePath);
  return libFeatureImportAllowedPrefixes.some((prefix) =>
    relativePath.startsWith(prefix),
  );
}

function isAllowedRouteAdapterConsumer(filePath: string) {
  const relativePath = relativeSourcePath(filePath);
  return (
    relativePath.startsWith(routeAdapterPrefix) ||
    (relativePath.startsWith("src/routes/api/") &&
      relativePath.endsWith("/+server.ts"))
  );
}

const deprecatedFeatureLibImports = [
  /^@\/lib\/admin-/,
  /^@\/lib\/course-(?:page|query|section)/,
  /^@\/lib\/page-data(?:-utils)?$/,
  /^@\/lib\/profile-copy$/,
  /^@\/lib\/public-(?:catalog|course-list|page-list|section-list|teacher-list)-data$/,
  /^@\/lib\/section-(?:code-match|page|query|search)/,
  /^@\/lib\/settings-/,
  /^@\/lib\/teacher-page-data$/,
  /^@\/lib\/user-profile-/,
];

describe("source import boundaries", () => {
  it("keeps src/lib infrastructure from importing feature modules outside surface adapters", async () => {
    const libFiles = await collectSourceFiles(
      path.join(process.cwd(), "src/lib"),
    );
    const violations: string[] = [];

    for (const filePath of libFiles) {
      if (isAllowedLibFeatureAdapter(filePath)) continue;
      const source = await fs.readFile(filePath, "utf8");
      const imports = featureImports(source);
      if (imports.length > 0) {
        violations.push(
          `${relativeSourcePath(filePath)} -> ${imports.join(", ")}`,
        );
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps route adapters out of feature, page action, and generic lib callers", async () => {
    const sourceFiles = await collectSourceFiles(
      path.join(process.cwd(), "src"),
    );
    const violations: string[] = [];

    for (const filePath of sourceFiles) {
      if (isAllowedRouteAdapterConsumer(filePath)) continue;

      const source = await fs.readFile(filePath, "utf8");
      const routeAdapterImports = importSpecifiers(source).filter((specifier) =>
        specifier.startsWith("@/lib/api/routes"),
      );
      if (routeAdapterImports.length > 0) {
        violations.push(
          `${relativeSourcePath(filePath)} -> ${routeAdapterImports.join(", ")}`,
        );
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps the HTTP route adapter feature-import ratchet from growing", async () => {
    const routeAdapterFiles = await collectSourceFiles(
      path.join(process.cwd(), routeAdapterPrefix),
    );
    const featureImportingFiles = new Set<string>();
    const imports: string[] = [];

    for (const filePath of routeAdapterFiles) {
      const source = await fs.readFile(filePath, "utf8");
      for (const specifier of featureImports(source)) {
        featureImportingFiles.add(relativeSourcePath(filePath));
        imports.push(`${relativeSourcePath(filePath)} -> ${specifier}`);
      }
    }

    expect(featureImportingFiles.size).toBeLessThanOrEqual(
      maxRouteAdapterFeatureImportFiles,
    );
    expect(imports.length).toBeLessThanOrEqual(maxRouteAdapterFeatureImports);
  });

  it("keeps feature code off deprecated src/lib domain barrels", async () => {
    const featureFiles = await collectSourceFiles(
      path.join(process.cwd(), "src/features"),
    );
    const violations: string[] = [];

    for (const filePath of featureFiles) {
      const source = await fs.readFile(filePath, "utf8");
      const forbiddenImports = importSpecifiers(source).filter((specifier) =>
        deprecatedFeatureLibImports.some((pattern) => pattern.test(specifier)),
      );
      if (forbiddenImports.length > 0) {
        violations.push(
          `${path.relative(process.cwd(), filePath)} -> ${forbiddenImports.join(", ")}`,
        );
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps feature lib and components free of database access", async () => {
    const featureFiles = await collectSourceFiles(
      path.join(process.cwd(), "src/features"),
    );
    const violations: string[] = [];

    for (const filePath of featureFiles) {
      const relativePath = path
        .relative(process.cwd(), filePath)
        .replace(/\\/g, "/");
      if (!/\/(?:components|lib)\//.test(relativePath)) continue;

      const source = await fs.readFile(filePath, "utf8");
      const dbImports = importSpecifiers(source).filter(
        (specifier) => specifier === "@/lib/db/prisma",
      );
      const modelAccess = /\bprisma\.[a-zA-Z]/.test(source);
      if (dbImports.length > 0 || modelAccess) {
        violations.push(
          `${relativePath}${dbImports.length > 0 ? ` -> ${dbImports.join(", ")}` : " -> prisma.*"}`,
        );
      }
    }

    expect(violations).toEqual([]);
  });
});
