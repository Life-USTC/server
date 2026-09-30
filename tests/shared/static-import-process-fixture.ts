import { type ChildProcess, spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ImportReport } from "@/static-loader/import-types";
import { nodeProtocolTest } from "./node-protocol-fixture";

export type StaticImportSnapshot = {
  metadata: Record<string, string>;
  tables: Record<string, Record<string, string | number | boolean | null>[]>;
};

export const staticImportProcessTest = nodeProtocolTest.extend<{
  staticImportProcess: {
    verify: (name: string) => Promise<void>;
    prepareSnapshot: (snapshot: StaticImportSnapshot) => Promise<{
      apply: () => Promise<ImportReport>;
    }>;
  };
}>({
  staticImportProcess: async (
    { isolatedDatabase, protocolRuntime, onTestFinished, expect },
    use,
  ) => {
    const directory = mkdtempSync(join(tmpdir(), "static-import-contract-"));
    const running: { child: ChildProcess; closed: Promise<number | null> }[] =
      [];
    const { connections } = isolatedDatabase;
    let closing = false;
    function run(script: string, args: string[]) {
      if (closing) throw new Error("Static import processes are closing");
      const child = spawn(
        "bun",
        [fileURLToPath(new URL(script, import.meta.url)), ...args],
        {
          detached: true,
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            ...process.env,
            FUNCTION_OWNER_DATABASE_URL: connections.owner,
            DATABASE_URL: connections.app,
            AUTH_DATABASE_URL: connections.auth,
            MAINTENANCE_DATABASE_URL: connections.maintenance,
          },
        },
      );
      let stdout = "";
      let stderr = "";
      let failure: Error | undefined;
      child.stdout.setEncoding("utf8").on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.setEncoding("utf8").on("data", (chunk) => {
        stderr += chunk;
      });
      child.on("error", (error) => {
        failure = error;
      });
      const closed = new Promise<number | null>((resolve) =>
        child.once("close", resolve),
      );
      running.push({ child, closed });
      return closed.then((code) => {
        if (failure) throw failure;
        return { code, signal: child.signalCode, stdout, stderr };
      });
    }
    const verify = (name: string) =>
      protocolRuntime.run(async () => {
        const { code, stdout, stderr } = await run(
          "../fixtures/static-import-contract.ts",
          [name, join(directory, "snapshot.sqlite")],
        );
        expect(code, stderr).toBe(0);
        expect(stdout).toContain(`CONTRACT_PASSED:${name}`);
      });
    const prepareSnapshot = (snapshot: StaticImportSnapshot) =>
      protocolRuntime.request(async () => {
        const invocation = crypto.randomUUID();
        const inputPath = join(directory, `${invocation}.input.json`);
        const snapshotPath = join(directory, `${invocation}.sqlite`);
        await writeFile(inputPath, JSON.stringify(snapshot));
        const { code, signal, stdout, stderr } = await run(
          "../fixtures/static-import-coverage.ts",
          ["prepare", inputPath, snapshotPath],
        );
        if (code !== 0)
          throw new Error(
            `Static snapshot preparation exited with code ${code}, signal ${signal}\n${stdout}\n${stderr}`,
          );
        return {
          apply: () =>
            protocolRuntime.request(async () => {
              const reportPath = join(
                directory,
                `${crypto.randomUUID()}.report.json`,
              );
              const { code, signal, stdout, stderr } = await run(
                "../fixtures/static-import-coverage.ts",
                ["apply", snapshotPath, reportPath],
              );
              if (code !== 0)
                throw new Error(
                  `Static import process exited with code ${code}, signal ${signal}\n${stdout}\n${stderr}`,
                );
              return JSON.parse(
                await readFile(reportPath, "utf8"),
              ) as ImportReport;
            }),
        };
      });
    try {
      await use({ verify, prepareSnapshot });
    } finally {
      closing = true;
      const results = await Promise.allSettled(
        running.map(async ({ child }) => {
          if (!child.pid) return;
          try {
            // A dead leader can leave its snapshot generator alive.
            process.kill(-child.pid, "SIGKILL");
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
          }
        }),
      );
      // Actual process/stdio closure precedes workflow drain and file/database
      // disposal, including expected failures and a runner timeout during setup.
      await Promise.all(running.map(({ closed }) => closed));
      // The runtime owner reports its original cached cleanup failure once.
      await Promise.allSettled([protocolRuntime.close()]);
      results.push(
        ...(await Promise.allSettled([
          rm(directory, { recursive: true, force: true }),
        ])),
      );
      const failures = results.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      if (failures.length) {
        const error = new AggregateError(
          failures,
          "Static import process cleanup failed",
        );
        onTestFinished(() => {
          throw error;
        });
      }
    }
  },
});
