import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { test, vi } from "vitest";
import {
  cleanupCatalogContractFixture,
  createCatalogContractFixture,
} from "../../shared/catalog-contract-fixture";
import { createTestPrisma } from "../../shared/prisma";
import { isolatedMcpTest } from "./_harness/isolated-context";

const execute = promisify(execFile);
const require = createRequire(import.meta.url);

// Native runner failures need a child process: this test must pass when its
// fixture fails, while independently checking that its resources were released.
test.for(["setup", "body-teardown", "timeout"] as const)(
  "MCP %s failure is reported and releases private resources",
  { tags: ["@MCP/MCP"] },
  async (phase, { expect }) => {
    const output = await mkdtemp(join(tmpdir(), "life-ustc-mcp-fixture-"));
    let passed = false;
    try {
      let exitCode = 0;
      try {
        const result = await execute(
          process.execPath,
          [
            join(require.resolve("vitest/package.json"), "..", "vitest.mjs"),
            "run",
            "--config",
            "tests/ci/fixtures/mcp-fixture-failure.config.ts",
          ],
          {
            env: {
              ...process.env,
              MCP_FIXTURE_PROBE_PHASE: phase,
              MCP_FIXTURE_PROBE_OUTPUT: output,
            },
            timeout: 25_000,
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
        exitCode = result.code ?? -1;
        await writeFile(
          join(output, "runner.log"),
          (result.stdout ?? "") + (result.stderr ?? ""),
        );
      }
      const load = async (name: string) =>
        JSON.parse(await readFile(join(output, name), "utf8"));
      const report = await load("report.json");
      expect(exitCode).toBe(1);
      expect(report).toMatchObject({
        success: false,
        numTotalTests: 1,
        numFailedTests: 1,
      });
      const failures = report.testResults
        .flatMap(
          (suite: { assertionResults: { failureMessages: string[] }[] }) =>
            suite.assertionResults.flatMap((result) => result.failureMessages),
        )
        .join("\n");
      const messages = {
        setup: ["MCP-NATIVE-SETUP"],
        "body-teardown": [
          "MCP-NATIVE-BODY",
          "MCP-NATIVE-CLOSE-first",
          "MCP-NATIVE-CLOSE-second",
        ],
        timeout: ["Test timed out in 5000ms"],
      };
      for (const message of messages[phase])
        expect(failures).toContain(message);

      const resources = await load("resources.json");
      expect(resources.todo).toEqual({
        id: expect.any(String),
        userId: "mcp-owner",
        title: "Committed native fixture state",
      });
      if (phase === "timeout") {
        const work = await load("timeout-work.json");
        expect(work).toMatchObject({
          nativeAborted: true,
          transportAborted: true,
        });
        expect(work.written).toEqual({
          id: expect.any(String),
          userId: "mcp-owner",
          title: "MCP write drained after native timeout",
        });
        expect(work.persisted).toEqual(work.written);
        expect(await load("timeout-client.json")).toEqual({
          outcome: "rejected",
        });
      }

      // Observe the real database, connections, dump directory and child processes;
      // private cleanup must complete even when test setup or SDK shutdown fails.
      const connection = new URL(process.env.FUNCTION_OWNER_DATABASE_URL ?? "");
      connection.pathname = "/postgres";
      const observer = createTestPrisma(connection.href);
      const names = [resources.template, resources.database];
      expect(new Set(names).size).toBe(2);
      for (const name of names)
        expect(name).toMatch(/^test_isolated_[0-9a-f]{32}$/);
      try {
        expect(
          await observer.$queryRawUnsafe(
            "SELECT datname FROM pg_database WHERE datname = ANY($1::text[])",
            names,
          ),
        ).toEqual([]);
        expect(
          await observer.$queryRawUnsafe(
            "SELECT datname FROM pg_stat_activity WHERE datname = ANY($1::text[]) OR application_name = ANY($1::text[])",
            names,
          ),
        ).toEqual([]);
      } finally {
        await observer.$disconnect();
      }
      expect(existsSync(resources.directory)).toBe(false);
      expect(resources.processes.length).toBeGreaterThan(0);
      for (const pid of resources.processes) {
        expect(() => process.kill(pid, 0)).toThrow(
          expect.objectContaining({ code: "ESRCH" }),
        );
      }
      passed = true;
    } finally {
      if (passed) await rm(output, { recursive: true, force: true });
      else console.error(`MCP fixture failure output: ${output}`);
    }
  },
);

isolatedMcpTest(
  "catalog initialization rolls back earlier records when a later entity conflicts",
  { tags: ["@MCP/MCP"] },
  async ({ mcpWorkflow, isolatedDatabase: { owner: db }, expect }) =>
    mcpWorkflow.run(async () => {
      const marker = crypto.randomUUID();
      const existing = await db.teacher.create({
        data: {
          jwId: 1_600_000_000 + Math.floor(Math.random() * 100_000_000),
          nameCn: `Unrelated teacher ${marker}`,
        },
      });
      let attemptedBase: number | undefined;
      const conflictingClient: Parameters<
        typeof createCatalogContractFixture
      >[0] = {
        $transaction: (run) =>
          db.$transaction(async (tx) => {
            const createTeacher = tx.teacher.create.bind(tx.teacher);
            const create = vi
              .spyOn(tx.teacher, "create")
              .mockImplementation((args) => {
                attemptedBase ??= args.data.jwId;
                return createTeacher({
                  ...args,
                  data: { ...args.data, jwId: existing.jwId },
                });
              });
            try {
              return await run(tx);
            } finally {
              create.mockRestore();
            }
          }),
      };
      try {
        await expect(
          createCatalogContractFixture(conflictingClient),
        ).rejects.toThrow();
        expect(attemptedBase).toBeTypeOf("number");
        if (attemptedBase === undefined)
          throw new Error("Teacher creation was not attempted");
        expect(
          await db.semester.count({ where: { jwId: attemptedBase } }),
        ).toBe(0);
        expect(
          await db.department.count({
            where: { jwId: { in: [attemptedBase, attemptedBase + 1] } },
          }),
        ).toBe(0);
        expect(
          await db.teacherTitle.count({
            where: { jwId: { in: [attemptedBase, attemptedBase + 1] } },
          }),
        ).toBe(0);
        expect(
          await db.teacher.findUnique({ where: { id: existing.id } }),
        ).toMatchObject({ nameCn: `Unrelated teacher ${marker}` });
      } finally {
        await db.teacher.deleteMany({ where: { id: existing.id } });
      }
    }),
);

isolatedMcpTest(
  "catalog cleanup preserves unrelated records inside the former random numeric range",
  { tags: ["@MCP/MCP"] },
  async ({ mcpWorkflow, isolatedDatabase: { owner: db }, expect }) =>
    mcpWorkflow.run(async () => {
      const fixture = await createCatalogContractFixture(db);
      let unrelatedId: number | undefined;
      try {
        const unrelated = await db.course.create({
          data: {
            jwId: fixture.base + 90,
            code: `unrelated-${fixture.marker}`,
            nameCn: "Unrelated course",
          },
        });
        unrelatedId = unrelated.id;
        await cleanupCatalogContractFixture(db, fixture);
        expect(
          await db.course.findUnique({ where: { id: unrelated.id } }),
        ).toMatchObject({ nameCn: "Unrelated course" });
        expect(
          await db.section.count({
            where: { id: { in: fixture.cleanupIds.sections } },
          }),
        ).toBe(0);
      } finally {
        if (unrelatedId)
          await db.course.deleteMany({ where: { id: unrelatedId } });
        await cleanupCatalogContractFixture(db, fixture);
      }
    }),
);
