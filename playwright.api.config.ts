import { defineConfig } from "@playwright/test";

const reportRoot = process.env.E2E_REPORT_ROOT ?? "playwright-report";

/** REST contract tests — no browser, request fixture only. */
export default defineConfig({
  testDir: "./tests/integration/rest",
  testMatch: ["**/*.test.ts", "**/test.ts"],
  outputDir: `${reportRoot}/api-results`,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // Preserve deterministic failures; each case owns its runtime lifecycle.
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    trace: "retain-on-failure",
  },
  globalSetup: "./tests/e2e/global-setup.ts",
});
