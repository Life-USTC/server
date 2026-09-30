import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { type TestContext, test, vi } from "vitest";
import type { McpFixtureFailurePhase } from "../../ci/fixtures/mcp-fixture-failure-reporter";
import {
  cleanupCatalogContractFixture,
  createCatalogContractFixture,
} from "../../shared/catalog-contract-fixture";
import { createTestPrisma } from "../../shared/prisma";
import { isolatedMcpTest } from "./_harness/isolated-context";

const execute = promisify(execFile);
const require = createRequire(import.meta.url);

type Resources = {
  template: string;
  database: string;
  directory: string;
  processes: number[];
  userIds: string[];
  todo: { id: string; userId: string; title: string };
  event: { id: string; userId: string };
};

async function verifyNativeLifecycle(
  phase: McpFixtureFailurePhase,
  { expect, annotate }: Pick<TestContext, "expect" | "annotate">,
) {
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
          cwd: resolve("."),
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
    const report = JSON.parse(
      await readFile(join(output, "report.json"), "utf8"),
    );
    const native = JSON.parse(
      await readFile(join(output, "native-result.json"), "utf8"),
    );
    expect(
      JSON.parse(
        await readFile(join(output, "native-run-errors.json"), "utf8"),
      ),
    ).toEqual([]);
    const resources = JSON.parse(
      await readFile(join(output, "resources.json"), "utf8"),
    ) as Resources;
    const phases = (await readFile(join(output, "phases.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { event: string; at: number });
    expect(exitCode).toBe(1);
    expect(report).toMatchObject({
      numTotalTests: 1,
      numFailedTests: 1,
      numPassedTests: 0,
      numPendingTests: 0,
      success: false,
    });
    expect(report.testResults).toHaveLength(1);
    expect(report.testResults[0].message).toBe("");
    expect(report.testResults[0].assertionResults).toHaveLength(1);
    expect(native).toMatchObject({
      title: "native MCP fixture failure releases all owned state",
      state: "failed",
    });
    const messages: Record<McpFixtureFailurePhase, string[]> = {
      setup: ["MCP-NATIVE-SETUP"],
      teardown: ["MCP-NATIVE-CLOSE-first", "MCP-NATIVE-CLOSE-second"],
      body: ["MCP-NATIVE-BODY"],
      "body-teardown": [
        "MCP-NATIVE-BODY",
        "MCP-NATIVE-CLOSE-first",
        "MCP-NATIVE-CLOSE-second",
      ],
      runtime: ["MCP-NATIVE-RUNTIME"],
      timeout: [
        'Test timed out in 5000ms.\nIf this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".',
      ],
    };
    expect(native.errors).toEqual(
      messages[phase].map((message) => ({ name: "Error", message })),
    );
    if (phase === "teardown" || phase === "body-teardown") {
      // Native results flatten the error; verify the actual aggregate separately.
      const raw = JSON.parse(
        await readFile(join(output, "raw-close-error.json"), "utf8"),
      );
      expect(raw.error).toEqual({
        name: "AggregateError",
        message: "Private MCP sessions failed to close",
        errors: [
          { name: "Error", message: "MCP-NATIVE-CLOSE-first" },
          { name: "Error", message: "MCP-NATIVE-CLOSE-second" },
        ],
      });
      expect(raw.at).toBeLessThanOrEqual(native.at);
    }
    if (phase === "runtime") {
      const raw = JSON.parse(
        await readFile(join(output, "raw-runtime-error.json"), "utf8"),
      );
      expect(raw.error).toEqual({
        name: "Error",
        message: "MCP-NATIVE-RUNTIME",
      });
      expect(raw.at).toBeLessThanOrEqual(native.at);
    }
    const events = phases.map((entry) => entry.event);
    const prefixes: Record<McpFixtureFailurePhase, string[]> = {
      setup: ["state-committed", "setup-rejected"],
      teardown: ["state-committed", "body-finished"],
      body: ["state-committed", "before-each-acquired", "body-rejected"],
      "body-teardown": ["state-committed", "body-rejected"],
      runtime: ["state-committed", "body-finished"],
      timeout: [
        "state-committed",
        "body-entered",
        "timeout-work-entered",
        "native-test-aborted",
      ],
    };
    const expectedEvents = [
      ...prefixes[phase],
      "first-close-start",
      "first-close-finished",
      "second-close-start",
      "second-close-finished",
      "runtime-close-start",
      "runtime-close-finished",
      "database-dispose-start",
      "database-dispose-finished",
      ...(phase === "timeout"
        ? [
            "timeout-session-close-start",
            "timeout-session-close-finished",
            "timeout-work-released",
            "timeout-write-finished",
            "timeout-client-settled",
          ]
        : []),
    ];
    expect(events.slice(0, prefixes[phase].length)).toEqual(prefixes[phase]);
    expect(events).toHaveLength(expectedEvents.length);
    expect([...events].sort()).toEqual(expectedEvents.sort());
    for (const name of ["first", "second"]) {
      const start = events.indexOf(`${name}-close-start`);
      const end = events.indexOf(`${name}-close-finished`);
      expect(start).toBeGreaterThan(1);
      expect(end).toBeGreaterThan(start);
      expect(phases[end].at).toBeLessThanOrEqual(native.at);
      expect(events.indexOf("runtime-close-start")).toBeGreaterThan(end);
    }
    expect(events.indexOf("runtime-close-finished")).toBeGreaterThan(
      events.indexOf("runtime-close-start"),
    );
    expect(events.indexOf("database-dispose-start")).toBeGreaterThan(
      events.indexOf("runtime-close-finished"),
    );
    expect(events.indexOf("database-dispose-finished")).toBeGreaterThan(
      events.indexOf("database-dispose-start"),
    );
    expect(phases.at(-1)?.event).toBe("database-dispose-finished");
    expect(phases.at(-1)?.at).toBeLessThanOrEqual(native.at);
    if (phase === "timeout") {
      const work = JSON.parse(
        await readFile(join(output, "timeout-work.json"), "utf8"),
      );
      const client = JSON.parse(
        await readFile(join(output, "timeout-client.json"), "utf8"),
      );
      expect(work.nativeAborted).toBe(true);
      expect(work.transportAborted).toBe(true);
      expect(work.written).toEqual({
        id: expect.any(String),
        userId: "mcp-owner",
        title: "MCP write drained after native timeout",
      });
      expect(work.persisted).toEqual(work.written);
      expect(client.outcome).toBe("rejected");
      const order = [
        "native-test-aborted",
        "timeout-session-close-start",
        "timeout-work-released",
        "timeout-write-finished",
        "timeout-session-close-finished",
        "runtime-close-start",
        "database-dispose-start",
      ];
      for (let i = 1; i < order.length; i++) {
        expect(events.indexOf(order[i])).toBeGreaterThan(
          events.indexOf(order[i - 1]),
        );
      }
      expect(events.indexOf("timeout-client-settled")).toBeLessThan(
        events.indexOf("database-dispose-start"),
      );
      expect(work.at).toBeLessThanOrEqual(native.at);
      expect(client.at).toBeLessThanOrEqual(native.at);
    }
    expect(resources.userIds).toEqual(["mcp-owner", "mcp-other"]);
    expect(resources.todo).toEqual({
      id: expect.any(String),
      userId: "mcp-owner",
      title: "Committed native fixture state",
    });
    expect(resources.event).toEqual({
      id: expect.any(String),
      userId: "mcp-owner",
    });
    expect(resources.database).toMatch(/^test_isolated_[0-9a-f]{32}$/);
    expect(resources.template).toMatch(/^test_isolated_[0-9a-f]{32}$/);
    const connection = new URL(process.env.FUNCTION_OWNER_DATABASE_URL ?? "");
    connection.pathname = "/postgres";
    const observer = createTestPrisma(connection.href);
    const names = [resources.template, resources.database];
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
      let code: string | undefined;
      try {
        process.kill(pid, 0);
      } catch (error) {
        code = (error as NodeJS.ErrnoException).code;
      }
      expect(code).toBe("ESRCH");
    }
    await annotate("Native MCP fixture cleanup verified", {
      contentType: "application/json",
      bodyEncoding: "utf-8",
      body: JSON.stringify({ phase, native, resources, phases }),
    });
    passed = true;
  } finally {
    if (passed) await rm(output, { recursive: true, force: true });
    else console.error(`Native MCP fixture failure evidence: ${output}`);
  }
}

test("MCP actor initialization failure removes the actor and its committed personal data", async (context) => {
  await verifyNativeLifecycle("setup", context);
});
test("MCP teardown failures still close the transport and delete actor state", async (context) => {
  await verifyNativeLifecycle("teardown", context);
});

test("MCP body failure after beforeEach acquisition releases all owned state", async (context) => {
  await verifyNativeLifecycle("body", context);
});
test("MCP body and session close failures preserve both errors after cleanup", async (context) => {
  await verifyNativeLifecycle("body-teardown", context);
});
test("MCP runtime close failure still disposes the private database", async (context) => {
  await verifyNativeLifecycle("runtime", context);
});
test("MCP native body timeout drains admitted SDK work before database disposal", async (context) => {
  await verifyNativeLifecycle("timeout", context);
});

isolatedMcpTest(
  "catalog initialization rolls back earlier records when a later entity conflicts",
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
