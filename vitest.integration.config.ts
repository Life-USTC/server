import dotenv from "dotenv";
import { defineConfig } from "vitest/config";
import { testTags } from "./tests/ci/test-tags.ts";
import { sharedAlias } from "./vitest.base.ts";

dotenv.config();

/** Integration schema and role setup lives in `tests/integration/AGENTS.md`. */
export default defineConfig({
  resolve: { alias: sharedAlias },
  test: {
    globalSetup: ["./tests/shared/runtime-database.ts"],
    environment: "node",
    globals: true,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: ["tests/integration/**/*.test.ts"],
    // REST contracts run under Playwright with a real Worker, not Vitest.
    exclude: ["tests/integration/rest/**"],
    tags: testTags,
    // Keep per-job resource use bounded; test fixtures own mutable state.
    fileParallelism: false,
  },
});
