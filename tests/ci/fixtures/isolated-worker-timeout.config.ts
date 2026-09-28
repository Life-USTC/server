import { defineConfig } from "@playwright/test";

const output = process.env.ISOLATED_WORKER_PROBE_OUTPUT;
if (!output) throw new Error("ISOLATED_WORKER_PROBE_OUTPUT is required");

export default defineConfig({
  testDir: ".",
  testMatch: "isolated-worker-timeout.scenario.ts",
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: [["json", { outputFile: `${output}/report.json` }]],
  outputDir: `${output}/results`,
});
