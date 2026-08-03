import dotenv from "dotenv";
import { defineConfig } from "vitest/config";
import { sharedAlias } from "./vitest.base";

dotenv.config();

/** Integration DB + seed setup lives in `tests/integration/AGENTS.md`. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    // `auth-record-cleanup` and `oauth-consent-transaction` assert exact
    // whole-table auth row counts, so concurrent files make them flaky.
    fileParallelism: false,
    globals: true,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: sharedAlias,
  },
});
