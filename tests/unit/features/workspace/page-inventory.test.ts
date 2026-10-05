import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SETTINGS_TABS } from "@/features/settings/lib/settings-tabs";
import { workspaceTabIds } from "@/features/workspace/lib/workspace-nav";
import {
  mobileScreenshotCases,
  PAGE_INVENTORY,
  routeIdFromPageFile,
} from "../../../e2e/src/app/_shared/page-inventory";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);
const routesRoot = path.join(repoRoot, "src/routes");

async function collectPageFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectPageFiles(fullPath)));
      continue;
    }
    if (entry.name === "+page.svelte") {
      files.push(fullPath);
    }
  }
  return files;
}

describe("browser route inventory", () => {
  it("lists every src/routes +page.svelte route id exactly once", async () => {
    const pageFiles = await collectPageFiles(routesRoot);
    const routeIds = pageFiles
      .map((file) => routeIdFromPageFile(path.relative(routesRoot, file)))
      .sort();

    const inventoryIds = PAGE_INVENTORY.map((entry) => entry.routeId).sort();
    expect(inventoryIds).toEqual(routeIds);

    const duplicates = inventoryIds.filter(
      (id, index) => inventoryIds.indexOf(id) !== index,
    );
    expect(duplicates).toEqual([]);
  });

  it("mobile route batches have unique paths and include current navigation tabs", () => {
    for (const group of ["public", "authed", "admin"] as const) {
      const paths = mobileScreenshotCases(group).map(({ path }) => path);
      expect(new Set(paths).size).toBe(paths.length);
      for (const entry of PAGE_INVENTORY.filter((entry) =>
        entry.mobileScreenshots?.includes(group),
      )) {
        expect(paths).toContain(entry.samplePath);
      }
    }
    const paths = mobileScreenshotCases("authed").map(({ path }) => path);
    for (const tab of workspaceTabIds)
      expect(paths).toContain(`/workspace/${tab}`);
    for (const tab of SETTINGS_TABS)
      expect(paths).toContain(`/account/settings/${tab}`);
  });
});
