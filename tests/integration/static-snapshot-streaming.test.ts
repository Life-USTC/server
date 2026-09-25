import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, it } from "vitest";

it("streams real SQLite semester groups in storage order with sparse children", async () => {
  const { stdout } = await promisify(execFile)("bun", [
    fileURLToPath(
      new URL("../fixtures/static-loader-streaming.ts", import.meta.url),
    ),
  ]);
  expect(stdout).toContain("SQLite semester streaming passed");
});
