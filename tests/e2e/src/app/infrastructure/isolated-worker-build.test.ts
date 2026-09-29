import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect } from "@playwright/test";
import { createFixturePrisma } from "../../../../shared/prisma";
import { test as workerTest } from "../../../utils/owned-worker";

type WorkerState = {
  database: string;
  directory: string;
  processGroup: number;
  origin: string;
};

const test = workerTest.extend<{ verifyCleanup: undefined }>({
  run: async ({ page: _page, run }, use) => {
    await use(run);
  },
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixture dependencies.
  verifyCleanup: async ({}, use, testInfo) => {
    await use(undefined);
    const state: WorkerState = JSON.parse(
      await readFile(testInfo.outputPath("isolated-worker-state.json"), "utf8"),
    );
    expect(existsSync(state.directory)).toBe(false);
    expect(() => process.kill(-state.processGroup, 0)).toThrow(
      expect.objectContaining({ code: "ESRCH" }),
    );
    await expect(
      fetch(state.origin, { signal: AbortSignal.timeout(3_000) }),
    ).rejects.toThrow();
    const database = createFixturePrisma();
    try {
      expect(
        await database.$queryRaw`SELECT datname FROM pg_database WHERE datname = ${state.database}`,
      ).toEqual([]);
      expect(
        await database.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname = ${state.database}`,
      ).toEqual([]);
    } finally {
      await database.$disconnect();
    }
  },
  _workerResources: async (
    { verifyCleanup: _verifyCleanup, _workerResources },
    use,
  ) => {
    await use(_workerResources);
  },
});

test("private Worker serves built assets and removes bundles after SIGKILL", async ({
  page,
  request,
  run,
}, testInfo) =>
  run(async () => {
    const response = await page.goto("/account/sign-in");
    expect(response?.status()).toBe(200);
    await expect(page.locator("#main-content")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute(
      "data-life-ustc-hydrated",
      "true",
    );
    const stylesheet = await page
      .locator('link[rel="stylesheet"][href*="/_app/immutable/"]')
      .first()
      .getAttribute("href");
    expect(stylesheet).toBeTruthy();
    const asset = await request.get(stylesheet as string);
    expect(asset.status()).toBe(200);
    expect(asset.headers()["content-type"]).toContain("text/css");
    expect(await asset.text()).toContain("{");

    const state: WorkerState = JSON.parse(
      await readFile(testInfo.outputPath("isolated-worker-state.json"), "utf8"),
    );
    const bundleDirectory = join(state.directory, ".wrangler", "tmp");
    const bundles = await readdir(bundleDirectory);
    expect(bundles.some((name) => name.startsWith("dev-"))).toBe(true);
    expect(bundles.some((name) => name.startsWith("bundle-"))).toBe(true);
    await writeFile(
      testInfo.outputPath("owned-builds.json"),
      JSON.stringify({ bundleDirectory, bundles }),
    );
    process.kill(-state.processGroup, "SIGKILL");
    await expect
      .poll(() => {
        try {
          process.kill(-state.processGroup, 0);
          return "running";
        } catch (error) {
          return (error as NodeJS.ErrnoException).code;
        }
      })
      .toBe("ESRCH");
    // SIGKILL cannot run child cleanup. The parent fixture must remove these.
    expect(await readdir(bundleDirectory)).toEqual(bundles);
  }));
