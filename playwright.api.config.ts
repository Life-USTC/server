import { defineConfig } from "@playwright/test";
import { getWorkerProcessEnvironment } from "./tests/e2e/utils/worker-database-env";

const port = process.env.E2E_PORT ?? "3000";
if (!/^\d+$/.test(port))
  throw new Error("E2E_PORT must be a numeric TCP port.");
const baseURL = `http://localhost:${port}`;
const reportRoot = process.env.E2E_REPORT_ROOT ?? "playwright-report";
const workerEnvironment = getWorkerProcessEnvironment();

/** REST contract tests — no browser, request fixture only. */
export default defineConfig({
  testDir: "./tests/integration/rest",
  testMatch: ["**/*.test.ts", "**/test.ts"],
  outputDir: `${reportRoot}/api-results`,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // Infrastructure retries belong around the complete shard, never around an
  // individual deterministic API assertion.
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  globalSetup: "./tests/e2e/global-setup.ts",
  webServer: {
    command: "env -u FUNCTION_OWNER_DATABASE_URL bun run e2e:server",
    url: baseURL,
    reuseExistingServer: false,
    gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
    stdout: "ignore",
    stderr: "pipe",
    timeout: 300_000,
    env: workerEnvironment,
  },
});
