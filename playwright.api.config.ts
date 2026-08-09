import { defineConfig } from "@playwright/test";

const baseURL = "http://localhost:3000";
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5432/life_ustc_dev";

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
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "pipe",
    timeout: 300_000,
    env: {
      ...process.env,
      // wrangler.e2e.jsonc hardcodes life_ustc_dev; point Hyperdrive at the
      // job DATABASE_URL so ci:integration (life_ustc_integration) works.
      CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: databaseUrl,
      CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_AUTH:
        databaseUrl,
      CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_MAINTENANCE:
        databaseUrl,
    },
  },
});
