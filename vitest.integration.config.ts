import dotenv from "dotenv";
import { defineConfig } from "vitest/config";
import { testTags } from "./tests/ci/test-tags";
import { sharedAlias } from "./vitest.base";

dotenv.config();

const sharedTest = {
  environment: "node" as const,
  globals: true,
  testTimeout: 30_000,
  hookTimeout: 30_000,
};

/** Integration schema and role setup lives in `tests/integration/AGENTS.md`. */
export default defineConfig({
  resolve: { alias: sharedAlias },
  test: {
    globalSetup: ["./tests/integration/global-setup.ts"],
    ...sharedTest,
    include: ["tests/integration/**/*.test.ts"],
    // REST contracts run under Playwright with a real Worker, not Vitest.
    exclude: ["tests/integration/rest/**"],
    tags: testTags,
    // Keep per-job resource use bounded; test fixtures own mutable state.
    fileParallelism: false,
  },
});
