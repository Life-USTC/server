import { type ChildProcess, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import { isolatedDatabaseTest } from "../shared/isolated-database";

const it = isolatedDatabaseTest.extend<{
  verify: (name: string) => Promise<void>;
}>({
  verify: async ({ isolatedDatabase }, use) => {
    const directory = await mkdtemp(join(tmpdir(), "static-import-contract-"));
    const running: { child: ChildProcess; closed: Promise<number | null> }[] =
      [];
    const { connections } = isolatedDatabase;
    const operations: Promise<void>[] = [];
    function verify(name: string) {
      const operation = (async () => {
        const child = spawn(
          "bun",
          [
            fileURLToPath(
              new URL("../fixtures/static-import-contract.ts", import.meta.url),
            ),
            name,
            join(directory, "snapshot.sqlite"),
          ],
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
        const code = await closed;
        if (failure) throw failure;
        expect(code, stderr).toBe(0);
        expect(stdout).toContain(`CONTRACT_PASSED:${name}`);
      })();
      operations.push(
        operation.then(
          () => undefined,
          () => undefined,
        ),
      );
      return operation;
    }
    try {
      await use(verify);
    } finally {
      await cleanup();
    }
    async function cleanup() {
      try {
        for (const { child } of running) {
          if (child.pid) {
            try {
              // A dead leader can leave its snapshot generator alive.
              // Stop the whole owned group even after the leader has exited.
              process.kill(-child.pid, "SIGKILL");
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code !== "ESRCH")
                throw error;
            }
          }
        }
        // Wait for actual process/stdio closure before the parent drops its DB.
        await Promise.all(running.map(({ closed }) => closed));
        await Promise.all(operations);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    }
  },
});

for (const name of [
  "course.static-section-course-link",
  "course.static-classification-unsupported",
  "section.source-lifecycle",
  "section.source-import-atomicity",
  "section.source-section-presence",
  "section.retirement-audit",
  "section.retirement-report",
]) {
  it(name, async ({ verify }) => verify(name));
}
