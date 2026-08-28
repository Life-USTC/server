import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { workspaceTabIds } from "@/features/dashboard/lib/dashboard-nav";
import { SETTINGS_TABS } from "@/features/settings/lib/settings-tabs";
import {
  BROWSER_ALIAS_INVENTORY,
  INVENTORY_SETTINGS_TABS,
  INVENTORY_WORKSPACE_TABS,
  mobileScreenshotPaths,
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

  it("keeps non-page browser aliases attached to executable redirect tests", async () => {
    for (const alias of BROWSER_ALIAS_INVENTORY) {
      const absolute = resolveSpecPath(alias.e2eSpec);
      expect(existsSync(absolute), `missing alias spec: ${alias.e2eSpec}`).toBe(
        true,
      );
      const source = await readFile(absolute, "utf8");
      expect(source).toContain(alias.path);
      expect(source).toContain(alias.target.split("/tag/")[0]);
      expect(source).toContain(alias.testName);
    }
  });

  it("requires one explicit mobile contract for every rendered page", async () => {
    const pageEntries = PAGE_INVENTORY.filter((entry) => entry.kind === "page");

    for (const entry of pageEntries) {
      const inventoryGroups = entry.mobileScreenshots ?? [];
      const hasInventoryCoverage = inventoryGroups.length > 0;
      const hasDedicatedCoverage = entry.mobileCoveredBy !== undefined;

      expect(
        Number(hasInventoryCoverage) + Number(hasDedicatedCoverage),
        `${entry.routeId} needs exactly one inventory-driven or dedicated mobile contract`,
      ).toBe(1);
      expect(
        new Set(inventoryGroups).size,
        `${entry.routeId} repeats a mobile screenshot group`,
      ).toBe(inventoryGroups.length);

      const dedicated = entry.mobileCoveredBy;
      if (!dedicated) continue;

      expect(
        dedicated.reason.trim(),
        `${entry.routeId} mobile coverage needs a reason`,
      ).not.toBe("");
      expect(
        dedicated.testName.trim(),
        `${entry.routeId} mobile coverage needs a test name`,
      ).not.toBe("");
      const absolute = resolveSpecPath(dedicated.e2eSpec);
      expect(
        existsSync(absolute),
        `${entry.routeId} missing mobile spec: ${dedicated.e2eSpec}`,
      ).toBe(true);
      const source = await readFile(absolute, "utf8");
      expect(
        source.includes(dedicated.testName),
        `${entry.routeId} mobile test ${dedicated.testName} is absent from ${dedicated.e2eSpec}`,
      ).toBe(true);
      expect(
        dedicated.e2eSpec.startsWith("mobile-screenshots/") ||
          source.includes("setViewportSize"),
        `${entry.routeId} dedicated mobile test does not configure a mobile viewport`,
      ).toBe(true);
    }

    for (const group of ["public", "authed", "admin"] as const) {
      const inventoryPaths = PAGE_INVENTORY.filter((entry) =>
        entry.mobileScreenshots?.includes(group),
      ).map((entry) => entry.samplePath);
      const paths = mobileScreenshotPaths(group);
      expect(new Set(paths).size).toBe(paths.length);
      for (const inventoryPath of inventoryPaths) {
        expect(paths).toContain(inventoryPath);
      }
    }

    const authedPaths = mobileScreenshotPaths("authed");
    for (const tab of workspaceTabIds) {
      expect(authedPaths).toContain(`/workspace/${tab}`);
    }
    for (const tab of SETTINGS_TABS) {
      expect(authedPaths).toContain(`/account/settings/${tab}`);
    }
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
        const actionSource = await loadSpec(action.e2eSpec);
        const roleIsExercised = action.role
          ? actionSource.includes(`getByRole("${action.role}"`) ||
            actionSource.includes(`getByRole('${action.role}'`)
          : false;
        const testIdIsExercised = action.testId
          ? actionSource.includes(action.testId)
          : false;
        const evidenceIsPresent = action.evidence
          ? actionSource.includes(action.evidence)
          : false;
        expect(
          roleIsExercised || testIdIsExercised || evidenceIsPresent,
          `${entry.routeId} primaryAction ${action.id} is not tied to a locator or evidence in ${action.e2eSpec}`,
        ).toBe(true);
      }
    }
  });
});
