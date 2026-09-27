import dotenv from "dotenv";
import { defineConfig } from "vitest/config";
import { sharedAlias } from "./vitest.base";

dotenv.config();

const sharedTest = {
  environment: "node" as const,
  globals: true,
  testTimeout: 30_000,
  hookTimeout: 30_000,
};

/** Integration DB + seed setup lives in `tests/integration/AGENTS.md`. */
export default defineConfig({
  resolve: { alias: sharedAlias },
  test: {
    reporters: process.env.SPEC_EVIDENCE_DIR
      ? [
          "default",
          [
            "json",
            {
              outputFile: `${process.env.SPEC_EVIDENCE_DIR}/vitest-${process.pid}.json`,
            },
          ],
        ]
      : ["default"],
    globalSetup: ["./tests/integration/global-setup.ts"],
    ...sharedTest,
    include: ["tests/integration/**/*.test.ts"],
    // REST contracts run under Playwright with a real Worker, not Vitest.
    exclude: ["tests/integration/rest/**"],
    // Integration fixtures share seeded users and database rows. Running the
    // files serially also keeps whole-table auth assertions deterministic.
    fileParallelism: false,
  },
});
