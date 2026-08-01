import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const sourceRoots = ["src"];

const hoverLiteralPattern =
  /data-sveltekit-preload-data\s*=\s*(?:"hover"|'hover'|\{\s*["']hover["']\s*\})/;
const hoverBooleanAttributePattern =
  /data-sveltekit-preload-data(?=[\s/>])(?!\s*=)/;

function hasHoverDataPreload(source: string): boolean {
  return (
    hoverLiteralPattern.test(source) ||
    hoverBooleanAttributePattern.test(source)
  );
}

async function collectSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(fullPath)));
      continue;
    }
    if (entry.name.endsWith(".svelte") || entry.name.endsWith(".html")) {
      files.push(fullPath);
    }
  }

  return files;
}

describe("navigation preload policy", () => {
  it("sets global code hover and data tap defaults in app.html", async () => {
    const appHtml = await readFile(path.join(repoRoot, "src/app.html"), "utf8");

    expect(appHtml).toMatch(/data-sveltekit-preload-code\s*=\s*["']hover["']/);
    expect(appHtml).toMatch(/data-sveltekit-preload-data\s*=\s*["']tap["']/);
    expect(hasHoverDataPreload(appHtml)).toBe(false);
  });

  it("disables SvelteKit data preload on detail section nav links", async () => {
    const detailNav = await readFile(
      path.join(repoRoot, "src/lib/components/DetailSectionNav.svelte"),
      "utf8",
    );

    expect(detailNav).toContain('data-sveltekit-preload-data="off"');
  });

  it("does not opt links back into hover data preload", async () => {
    const violations: string[] = [];

    for (const root of sourceRoots) {
      const files = await collectSourceFiles(path.join(repoRoot, root));
      for (const file of files) {
        const source = await readFile(file, "utf8");
        if (!hasHoverDataPreload(source)) continue;
        violations.push(path.relative(repoRoot, file));
      }
    }

    expect(violations).toEqual([]);
  });
});
