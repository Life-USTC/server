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

const libFeatureImportAllowedPrefixes = [
  "src/lib/api/routes/",
  "src/lib/api/schemas/",
  "src/lib/mcp/",
];

function isAllowedLibFeatureAdapter(filePath: string) {
  const relativePath = path
    .relative(process.cwd(), filePath)
    .replace(/\\/g, "/");
  return libFeatureImportAllowedPrefixes.some((prefix) =>
    relativePath.startsWith(prefix),
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
      const featureImports = importSpecifiers(source).filter((specifier) =>
        specifier.startsWith("@/features/"),
      );
      if (featureImports.length > 0) {
        violations.push(
          `${path.relative(process.cwd(), filePath)} -> ${featureImports.join(", ")}`,
        );
      }
    }

    expect(violations).toEqual([]);
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
});
