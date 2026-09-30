import { defineConfig } from "vitest/config";
import { sharedAlias } from "../../../vitest.base";

const output = process.env.SHARED_CLEANUP_PROBE_OUTPUT;
if (!output) throw new Error("SHARED_CLEANUP_PROBE_OUTPUT is required");
export default defineConfig({
  resolve: { alias: sharedAlias },
  test: {
    include: ["tests/ci/fixtures/shared-cleanup-failure.scenario.ts"],
    environment: "node",
    pool: "forks",
    maxWorkers: 1,
    fileParallelism: false,
    retry: 0,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    reporters: [
      "json",
      "./tests/ci/fixtures/shared-cleanup-failure-reporter.ts",
    ],
    outputFile: `${output}/report.json`,
  },
});
