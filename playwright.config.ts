import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";
import {
  appendLocalNoProxy,
  buildPlaywrightServerEnv,
  resolvePlaywrightHarnessRuntime,
} from "./tools/dev/e2e";

process.env.NO_PROXY = appendLocalNoProxy(process.env.NO_PROXY);
process.env.no_proxy = appendLocalNoProxy(process.env.no_proxy);

const playwrightRuntime = resolvePlaywrightHarnessRuntime();

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["**/*.spec.ts", "**/*.test.ts", "**/test.ts"],
  globalSetup: "./tests/e2e/global-setup.ts",
  outputDir: "test-results/e2e",
  fullyParallel: playwrightRuntime.fullyParallel,
  forbidOnly: playwrightRuntime.forbidOnly,
  retries: playwrightRuntime.retries,
  // Shared seeded users are mutated by several E2E files. Keep the suite
  // single-worker so those stateful cases run sequentially.
  workers: 1,
  reporter: playwrightRuntime.reporter,
  use: {
    baseURL: playwrightRuntime.baseUrl,
    trace: playwrightRuntime.trace,
    screenshot: playwrightRuntime.screenshot,
  },
  webServer: {
    command: "bun run tools/dev/e2e.ts start",
    env: buildPlaywrightServerEnv({
      host: playwrightRuntime.host,
      port: playwrightRuntime.port,
      baseUrl: playwrightRuntime.baseUrl,
    }),
    url: playwrightRuntime.baseUrl,
    reuseExistingServer: playwrightRuntime.reuseExistingServer,
    stdout: "ignore",
    stderr: "pipe",
    // Package scripts own build-time staging; Playwright starts the staged Worker locally.
    timeout: playwrightRuntime.webServerTimeoutMs,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
