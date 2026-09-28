import { defineConfig } from "vitest/config";
import { sharedAlias } from "../../../vitest.base";

const output = process.env.ISOLATED_DATABASE_PROBE_OUTPUT;
if (!output) throw new Error("ISOLATED_DATABASE_PROBE_OUTPUT is required");
export default defineConfig({
  resolve: { alias: sharedAlias },
  test: {
    include: ["tests/ci/fixtures/isolated-database-timeout.scenario.ts"],
    environment: "node",
    pool: "forks",
    maxWorkers: 1,
    fileParallelism: false,
    retry: 0,
    testTimeout:
      process.env.ISOLATED_DATABASE_PROBE_PHASE === "clone" ? 4_000 : 10_000,
    hookTimeout: 10_000,
    reporters: ["json"],
    outputFile: `${output}/report.json`,
  },
});
