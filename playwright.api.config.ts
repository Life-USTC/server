import { defineConfig } from "@playwright/test";

const baseURL = "http://localhost:3000";

/** REST contract tests — no browser, request fixture only. */
export default defineConfig({
  testDir: "./tests/integration/rest",
  testMatch: ["**/*.test.ts", "**/test.ts"],
  outputDir: "playwright-report/api-results",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"]] : [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: "bun run e2e:server",
    url: baseURL,
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
    timeout: 300_000,
  },
});
