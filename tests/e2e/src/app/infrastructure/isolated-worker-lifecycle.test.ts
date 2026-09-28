import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { promisify, stripVTControlCharacters } from "node:util";
import { expect, test } from "@playwright/test";
import { createTestPrisma } from "../../../../shared/prisma";

const execute = promisify(execFile);
const require = createRequire(import.meta.url);

type State = {
  database?: string;
  template: string;
  directory?: string;
  processGroup?: number;
  processes?: number[];
};
async function findState(
  directory: string,
  template = false,
): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory()
        ? findState(path, template)
        : (
              template
                ? entry.name.startsWith("template-state-")
                : entry.name === "isolated-worker-state.json"
            )
          ? [path]
          : [];
    }),
  );
  return nested.flat();
}

type ReportSuite = {
  suites?: ReportSuite[];
  specs?: Array<{
    tests: Array<{
      results: Array<{ status: string; errors: Array<{ message: string }> }>;
    }>;
  }>;
};
function results(
  suite: ReportSuite,
): Array<{ status: string; errors: Array<{ message: string }> }> {
  return [
    ...(suite.specs ?? []).flatMap((spec) =>
      spec.tests.flatMap((test) => test.results),
    ),
    ...(suite.suites ?? []).flatMap(results),
  ];
}

for (const phase of [
  "template",
  "clone",
  "ready",
  "health",
  "actor",
  "session",
] as const) {
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixture dependencies.
  test(`private Worker native ${phase} setup timeout leaves no resources`, async ({}, testInfo) => {
    test.setTimeout(150_000);
    const output = testInfo.outputPath("native-timeout");
    await mkdir(output, { recursive: true });
    let exitCode = 0;
    try {
      const run = await execute(
        process.execPath,
        [
          join(require.resolve("playwright/package.json"), "..", "cli.js"),
          "test",
          "--config",
          "tests/ci/fixtures/isolated-worker-timeout.config.ts",
        ],
        {
          cwd: resolve("."),
          env: {
            ...process.env,
            ISOLATED_WORKER_PROBE_PHASE: phase,
            ISOLATED_WORKER_PROBE_OUTPUT: output,
          },
          timeout: 120_000,
          maxBuffer: 4 * 1024 * 1024,
        },
      );
      await writeFile(join(output, "runner.log"), run.stdout + run.stderr);
    } catch (error) {
      const run = error as { code?: number; stdout?: string; stderr?: string };
      exitCode = run.code ?? -1;
      await writeFile(
        join(output, "runner.log"),
        (run.stdout ?? "") + (run.stderr ?? ""),
      );
    }
    const report = JSON.parse(
      await readFile(join(output, "report.json"), "utf8"),
    ) as ReportSuite & { errors: unknown[] };
    expect(exitCode).toBe(1);
    expect(report.errors).toEqual([]);
    const attempts = results(report);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].status).toBe("timedOut");
    expect(attempts[0].errors).toHaveLength(2);
    const acquisitionPhase = phase === "actor" || phase === "session";
    expect(
      stripVTControlCharacters(attempts[0].errors[0].message).split("\n")[0],
    ).toBe(
      `Fixture "${phase === "template" ? "databaseTemplate" : acquisitionPhase ? "acquiringActor" : "isolatedWorker"}" timeout of ${phase === "template" ? 10000 : acquisitionPhase ? 1000 : phase === "clone" ? 2000 : 20000}ms exceeded during setup.`,
    );
    expect(
      stripVTControlCharacters(attempts[0].errors[1].message).split("\n")[0],
    ).toBe(
      phase === "template"
        ? "Error: Database template resources disposed"
        : "Error: Private Worker resources disposed",
    );
    const states = await findState(
      join(output, "results"),
      phase === "template",
    );
    expect(states).toHaveLength(1);
    const state = JSON.parse(await readFile(states[0], "utf8")) as State;
    const marker = JSON.parse(
      await readFile(
        phase === "template"
          ? join(output, "results", "fault-observed-template.json")
          : acquisitionPhase
            ? join(output, "acquisition-observed.json")
            : join(states[0], "..", "fault-observed.json"),
        "utf8",
      ),
    );
    expect(marker.phase).toBe(phase);
    if (phase === "template") {
      expect(marker.template).toBe(state.template);
      expect(marker.process).toBeGreaterThan(0);
      expect(state.processes).toContain(marker.process);
      expect(marker.activity).toEqual([
        {
          datname: state.template,
          wait_event: "PgSleep",
          query: "SELECT pg_sleep(60) /* private-template-timeout */",
        },
      ]);
    } else if (phase === "clone") {
      expect(marker.activity).toEqual([
        {
          query: expect.stringContaining(`CREATE DATABASE "${state.database}"`),
          state: "active",
        },
      ]);
      expect(state.processGroup).toBeUndefined();
    } else if (acquisitionPhase) {
      expect(state.processGroup).toBeGreaterThan(0);
      expect(marker).toEqual({
        phase,
        users: 1,
        sessions: 1,
        contextsCreated: 1,
        contextsDisposed: 1,
        acquisitionError: "Private Worker resources disposed",
        lateActorError: "Private Worker resources disposed",
        lateSessionError: "Private Worker resources disposed",
      });
    } else {
      expect(state.processGroup).toBeGreaterThan(0);
      if (phase === "ready") expect(marker.port).toBeGreaterThan(0);
      else expect(marker.pendingHttpRequest).toBe(true);
    }
    const names = [state.template, ...(state.database ? [state.database] : [])];
    const connection = new URL(process.env.FUNCTION_OWNER_DATABASE_URL ?? "");
    connection.pathname = "/postgres";
    const db = createTestPrisma(connection.href);
    try {
      expect(
        await db.$queryRawUnsafe(
          "SELECT datname FROM pg_database WHERE datname = ANY($1::text[])",
          names,
        ),
      ).toEqual([]);
      expect(
        await db.$queryRawUnsafe(
          "SELECT datname FROM pg_stat_activity WHERE datname = ANY($1::text[]) OR application_name = $2",
          names,
          state.database ?? state.template,
        ),
      ).toEqual([]);
    } finally {
      await db.$disconnect();
    }
    if (state.directory) expect(existsSync(state.directory)).toBe(false);
    for (const pid of state.processes ?? []) {
      let code: string | undefined;
      try {
        process.kill(pid, 0);
      } catch (error) {
        code = (error as NodeJS.ErrnoException).code;
      }
      expect(code).toBe("ESRCH");
    }
    if (state.processGroup) {
      let code: string | undefined;
      try {
        process.kill(-state.processGroup, 0);
      } catch (error) {
        code = (error as NodeJS.ErrnoException).code;
      }
      expect(code).toBe("ESRCH");
    }
  });
}
