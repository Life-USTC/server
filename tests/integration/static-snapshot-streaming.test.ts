import { execFile } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, it } from "vitest";

it("streams real SQLite semester groups in storage order with sparse children", async ({ signal, onTestFinished }) => {
  const directory = mkdtempSync(join(tmpdir(), "static-streaming-owner-"));
  let closed: Promise<void> | undefined;
  onTestFinished(async () => {
    // execFile can reject on abort before the process and its stdio close.
    await closed;
    await rm(directory, { recursive: true, force: true });
  });
  const execution = promisify(execFile)(
    "bun",
    [
      fileURLToPath(
        new URL("../fixtures/static-loader-streaming.ts", import.meta.url),
      ),
    ],
    { env: { ...process.env, TMPDIR: directory }, signal, killSignal: "SIGKILL" },
  );
  closed = new Promise((resolve) =>
    execution.child.once("close", () => resolve()),
  );
  const { stdout } = await execution;
  expect(stdout).toContain("SQLite semester streaming passed");
});
