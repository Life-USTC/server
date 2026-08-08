import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { workspaceTabIds } from "@/features/dashboard/lib/dashboard-nav";
import { SETTINGS_TABS } from "@/features/settings/lib/settings-tabs";
import {
  INVENTORY_SETTINGS_TABS,
  INVENTORY_WORKSPACE_TABS,
  PAGE_INVENTORY,
  type PageInventoryEntry,
  routeIdFromPageFile,
} from "../e2e/src/app/_shared/page-inventory";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const routesRoot = path.join(repoRoot, "src/routes");
const e2eRoot = path.join(repoRoot, "tests/e2e");
const pageContractPath = path.join(e2eRoot, "src/app/_shared/page-contract.ts");

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

function isContractHandled(
  contractPath: string,
  contractSource: string,
  cases: Set<string>,
): boolean {
  if (cases.has(contractPath)) {
    return true;
  }
  if (
    contractPath === "/account/settings" ||
    contractPath.startsWith("/account/settings/")
  ) {
    return contractSource.includes(
      'routePath.startsWith("/account/settings/")',
    );
  }
  if (
    contractPath === "/workspace" ||
    contractPath === "/workspace/[tab]" ||
    contractPath.startsWith("/workspace/")
  ) {
    return (
      contractSource.includes('routePath.startsWith("/workspace/")') ||
      contractSource.includes('routePath === "/workspace"')
    );
  }
  return false;
}

function resolveSpecPath(relative: string) {
  return path.join(e2eRoot, relative);
}

function entryHasContractCaller(
  entry: PageInventoryEntry,
  specSources: Map<string, string>,
): boolean {
  const candidates = [entry.e2eSpec, entry.coveredBy].filter(
    (value): value is string => Boolean(value),
  );
  if (candidates.length === 0) {
    return false;
  }
  return candidates.some((relative) => {
    const source = specSources.get(relative);
    if (!source) {
      return false;
    }
    return (
      source.includes("assertPageContract") &&
      (source.includes(entry.contractPath) ||
        source.includes(`routePath: "${entry.contractPath}"`) ||
        // Workspace/settings often pass concrete sample paths via variables.
        entry.contractPath.startsWith("/workspace") ||
        entry.contractPath.startsWith("/account/settings") ||
        entry.contractPath.includes("["))
    );
  });
}

describe("page inventory gate", () => {
  it("keeps settings and workspace tab ids aligned with product constants", () => {
    expect([...INVENTORY_SETTINGS_TABS]).toEqual([...SETTINGS_TABS]);
    expect([...INVENTORY_WORKSPACE_TABS]).toEqual([...workspaceTabIds]);
  });

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

  it("requires L1 contract wiring and L2 primary-action coverage", async () => {
    const contractSource = await readFile(pageContractPath, "utf8");
    const cases = new Set(
      [...contractSource.matchAll(/case\s+"([^"]+)":/g)].map(
        (match) => match[1],
      ),
    );

    const specSources = new Map<string, string>();
    async function loadSpec(relative: string) {
      const cached = specSources.get(relative);
      if (cached !== undefined) {
        return cached;
      }
      const absolute = resolveSpecPath(relative);
      expect(existsSync(absolute), `missing e2e spec: ${relative}`).toBe(true);
      const source = await readFile(absolute, "utf8");
      specSources.set(relative, source);
      return source;
    }

    const pageEntries = PAGE_INVENTORY.filter((entry) => entry.kind === "page");
    const redirectEntries = PAGE_INVENTORY.filter(
      (entry) => entry.kind === "redirect",
    );

    for (const entry of [...pageEntries, ...redirectEntries]) {
      const caller = entry.e2eSpec ?? entry.coveredBy;
      expect(caller, `${entry.routeId} missing e2eSpec/coveredBy`).toBeTruthy();
      if (!caller) {
        continue;
      }
      await loadSpec(caller);

      expect(
        isContractHandled(entry.contractPath, contractSource, cases),
        `${entry.routeId} contractPath ${entry.contractPath} is not handled by assertPageContract`,
      ).toBe(true);

      if (entry.kind === "page") {
        const callerSource = await loadSpec(caller);
        expect(
          entryHasContractCaller(entry, specSources) ||
            callerSource.includes("assertPageContract"),
          `${entry.routeId} has no assertPageContract caller in ${caller}`,
        ).toBe(true);
      }

      for (const action of entry.primaryActions ?? []) {
        if (action.exemption) {
          expect(
            action.exemption === "decorative" ||
              action.exemption === "live-oauth" ||
              action.exemption.startsWith("covered-by:"),
          ).toBe(true);
          continue;
        }
        expect(
          action.e2eSpec,
          `${entry.routeId} primaryAction ${action.id} needs e2eSpec or exemption`,
        ).toBeTruthy();
        if (!action.e2eSpec) {
          continue;
        }
        await loadSpec(action.e2eSpec);
      }
    }
  });
});
