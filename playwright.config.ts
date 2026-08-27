import { defineConfig, devices } from "@playwright/test";

const e2ePort = process.env.E2E_PORT ?? "3000";
const inspectorPort = process.env.E2E_INSPECTOR_PORT;

if (!/^\d+$/.test(e2ePort)) {
  throw new Error("E2E_PORT must be a numeric TCP port.");
}
if (inspectorPort && !/^\d+$/.test(inspectorPort)) {
  throw new Error("E2E_INSPECTOR_PORT must be a numeric TCP port.");
}

const baseURL = `http://localhost:${e2ePort}`;
const reportRoot = process.env.E2E_REPORT_ROOT ?? "playwright-report";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: [
    "src/app/**/*.spec.ts",
    "src/app/**/*.test.ts",
    "src/app/**/test.ts",
  ],
  outputDir: `${reportRoot}/e2e-results`,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  failOnFlakyTests: !!process.env.CI,
  // Infrastructure retries are owned by tests/ci/e2e-run-shard.sh. Playwright
  // retries individual tests too broadly for a deterministic assertion.
  retries: 0,
  // Shared seeded users are mutated by several E2E files. Keep the suite
  // single-worker so those stateful cases run sequentially.
  workers: 1,
  reporter: process.env.CI
    ? [["list"], ["blob", { outputDir: `${reportRoot}/blob` }]]
    : [
        ["list"],
        ["html", { open: "never", outputFolder: `${reportRoot}/html` }],
      ],
  snapshotPathTemplate:
    "{testDir}/visual-matrix/snapshots/{arg}{-projectName}{ext}",
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.02,
    },
  },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: { mode: "only-on-failure", fullPage: true },
  },
  webServer: {
    command:
      `E2E_PORT=${e2ePort} E2E_APP_PUBLIC_ORIGIN=${JSON.stringify(baseURL)} ` +
      `bun run e2e:server`,
    url: baseURL,
    reuseExistingServer: false,
    gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
    stdout: "ignore",
    stderr: "pipe",
    timeout: 300_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
      testMatch: ["mobile-screenshots/**/*.spec.ts"],
    },
    {
      name: "visual-mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
      },
      testMatch: ["visual-matrix/**/*.spec.ts"],
    },
    {
      name: "visual-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
      },
      testMatch: ["visual-matrix/**/*.spec.ts"],
    },
  ],
});
