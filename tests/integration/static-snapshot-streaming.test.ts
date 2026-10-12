import { execFile } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, it } from "vitest";

it("streams real SQLite semester groups in storage order with sparse children", {
  tags: ["@StaticImport/Runtime"],
}, async ({ signal, onTestFinished }) => {
  const directory = mkdtempSync(join(tmpdir(), "static-streaming-owner-"));
  let closed: Promise<void> | undefined;
  let abort: (() => void) | undefined;
  onTestFinished(async () => {
    if (abort) signal.removeEventListener("abort", abort);
    // Signal delivery is not process/stdio completion; join native close first.
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
    { env: { ...process.env, TMPDIR: directory } },
  );
  closed = new Promise((resolve) =>
    execution.child.once("close", () => resolve()),
  );
  // execFile does not forward killSignal to its AbortSignal spawn path.
  abort = () => {
    execution.child.kill("SIGKILL");
  };
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  const { stdout } = await execution;
  expect(stdout).toContain("SQLite semester streaming passed");
});
