import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify, stripVTControlCharacters } from "node:util";
import { expect, test } from "vitest";
import { createTestPrisma } from "../shared/prisma";

const execute = promisify(execFile);
const require = createRequire(import.meta.url);
type Resources = {
  template: string;
  database?: string;
  directory: string;
  processes: number[];
};
type Report = {
  numTotalTests: number;
  numFailedTests: number;
  testResults: Array<{
    message: string;
    assertionResults: Array<{
      title: string;
      status: string;
      failureMessages: string[];
    }>;
  }>;
};

for (const phase of ["template", "clone"] as const) {
  test(`Vitest native ${phase} setup timeout releases its database resources`, async ({
    annotate,
  }) => {
    const output = await mkdtemp(join(tmpdir(), "life-ustc-vitest-timeout-"));
    let passed = false;
    try {
      let code = 0;
      try {
        const result = await execute(
          process.execPath,
          [
            join(require.resolve("vitest/package.json"), "..", "vitest.mjs"),
            "run",
            "--config",
            "tests/ci/fixtures/isolated-database-timeout.config.ts",
          ],
          {
            cwd: resolve("."),
            env: {
              ...process.env,
              ISOLATED_DATABASE_PROBE_PHASE: phase,
              ISOLATED_DATABASE_PROBE_OUTPUT: output,
            },
            timeout: 45_000,
            maxBuffer: 4 * 1024 * 1024,
          },
        );
        await writeFile(
          join(output, "runner.log"),
          result.stdout + result.stderr,
        );
      } catch (error) {
        const result = error as {
          code?: number;
          stdout?: string;
          stderr?: string;
        };
        code = result.code ?? -1;
        await writeFile(
          join(output, "runner.log"),
          (result.stdout ?? "") + (result.stderr ?? ""),
        );
      }
      const report = JSON.parse(
        await readFile(join(output, "report.json"), "utf8"),
      ) as Report;
      expect(code).toBe(1);
      expect(report.numTotalTests).toBe(1);
      expect(report.numFailedTests).toBe(1);
      expect(report.testResults).toHaveLength(1);
      expect(report.testResults[0].message).toBe("");
      const assertions = report.testResults[0].assertionResults;
      expect(assertions).toHaveLength(1);
      expect(assertions[0].title).toBe(
        "native database setup timeout releases owned resources",
      );
      expect(assertions[0].status).toBe("failed");
      expect(assertions[0].failureMessages).toHaveLength(1);
      expect(
        stripVTControlCharacters(assertions[0].failureMessages[0]).split(
          "\n",
        )[0],
      ).toBe(
        `Error: Test timed out in ${phase === "template" ? 10000 : 4000}ms.`,
      );
      const resources = JSON.parse(
        await readFile(join(output, "resources.json"), "utf8"),
      ) as Resources;
      const marker = JSON.parse(
        await readFile(join(output, "fault-observed.json"), "utf8"),
      );
      expect(marker.phase).toBe(phase);
      expect(marker.activity).toHaveLength(1);
      if (phase === "template") {
        expect(marker.activity[0]).toMatchObject({
          datname: resources.template,
          application_name: "psql",
          state: "active",
          wait_event: "PgSleep",
          query: "SELECT pg_sleep(60) /* vitest-template-timeout */",
        });
        expect(resources.database).toBeUndefined();
      } else {
        expect(resources.database).toMatch(/^test_isolated_[0-9a-f]{32}$/);
        expect(marker.activity[0]).toMatchObject({
          application_name: resources.database,
          state: "active",
          query: expect.stringContaining(
            `CREATE DATABASE "${resources.database}"`,
          ),
        });
      }
      const connection = new URL(process.env.FUNCTION_OWNER_DATABASE_URL ?? "");
      connection.pathname = "/postgres";
      const db = createTestPrisma(connection.href);
      const names = [
        resources.template,
        ...(resources.database ? [resources.database] : []),
      ];
      let remainingDatabases: Array<{ datname: string }>;
      let remainingConnections: Array<{ datname: string }>;
      try {
        remainingDatabases = await db.$queryRawUnsafe(
          "SELECT datname FROM pg_database WHERE datname = ANY($1::text[])",
          names,
        );
        remainingConnections = await db.$queryRawUnsafe(
          "SELECT datname FROM pg_stat_activity WHERE datname = ANY($1::text[]) OR application_name = ANY($1::text[])",
          names,
        );
      } finally {
        await db.$disconnect();
      }
      expect(remainingDatabases).toEqual([]);
      expect(remainingConnections).toEqual([]);
      const directoryExists = existsSync(resources.directory);
      expect(directoryExists).toBe(false);
      const processes: Array<{ pid: number; error: string | undefined }> = [];
      for (const pid of resources.processes) {
        let code: string | undefined;
        try {
          process.kill(pid, 0);
        } catch (error) {
          code = (error as NodeJS.ErrnoException).code;
        }
        processes.push({ pid, error: code });
        expect(code).toBe("ESRCH");
      }
      await annotate("Native database timeout cleanup verified", {
        contentType: "application/json",
        bodyEncoding: "utf-8",
        body: JSON.stringify({
          phase,
          nativeFailure: assertions[0].failureMessages,
          resources,
          observedFault: marker,
          remainingDatabases,
          remainingConnections,
          directoryExists,
          processes,
        }),
      });
      passed = true;
    } finally {
      if (passed) await rm(output, { recursive: true, force: true });
      else console.error(`Native database timeout evidence: ${output}`);
    }
  }, 60_000);
}
