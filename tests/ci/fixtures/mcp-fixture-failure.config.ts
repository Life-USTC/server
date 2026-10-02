import { defineConfig } from "vitest/config";
import { sharedAlias } from "../../../vitest.base";

const output = process.env.MCP_FIXTURE_PROBE_OUTPUT;
if (!output) throw new Error("MCP_FIXTURE_PROBE_OUTPUT is required");
export default defineConfig({
  resolve: { alias: sharedAlias },
  test: {
    include: ["tests/ci/fixtures/mcp-fixture-failure.scenario.ts"],
    environment: "node",
    pool: "forks",
    maxWorkers: 1,
    fileParallelism: false,
    retry: 0,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    reporters: ["json"],
    outputFile: `${output}/report.json`,
  },
});
