import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { expect } from "@playwright/test";
import { createFixturePrisma } from "../../../../shared/prisma";
import { test as workerTest } from "../../../utils/owned-worker";

type WorkerState = {
  database: string;
  directory: string;
  processGroup: number;
  origin: string;
};

async function prebuiltWorkerContents() {
  const directory = resolve(".svelte-kit/test-worker");
  const files = (await readdir(directory)).sort();
  return Promise.all(
    files.map(async (file) => ({
      file,
      hash: createHash("sha256")
        .update(await readFile(join(directory, file)))
        .digest("hex"),
    })),
  );
}

const test = workerTest.extend<{ verifyCleanup: undefined }>({
  run: async ({ page: _page, run }, use) => {
    await use(run);
  },
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixture dependencies.
  verifyCleanup: async ({}, use, testInfo) => {
    const prebuilt = await prebuiltWorkerContents();
    await use(undefined);
    expect(await prebuiltWorkerContents()).toEqual(prebuilt);
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

test("private Worker serves built assets and preserves shared code after SIGKILL", async ({
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

test("private Worker errors retain original source locations", async ({
  request,
  run,
}, testInfo) =>
  run(async () => {
    const key = `uploads/${crypto.randomUUID()}/${crypto.randomUUID()}`;
    const response = await request.post(
      `/__test/storage/uploads?key=${encodeURIComponent(key)}&deleteProbe`,
      {
        headers: {
          "x-test-storage-secret": "local-test-storage-observer",
          "content-type": "application/json",
        },
        data: Buffer.from("{"),
      },
    );
    expect(response.status()).toBe(500);
    await response.body();
    await expect
      .poll(() => readFile(testInfo.outputPath("isolated-worker.log"), "utf8"))
      .toMatch(/tests\/ci\/fixtures\/e2e-storage-worker\.ts:\d+:\d+/);
    const health = await request.get("/api/health");
    expect(health.status()).toBe(200);
    expect(await health.text()).toBe("ok\n");
  }));
