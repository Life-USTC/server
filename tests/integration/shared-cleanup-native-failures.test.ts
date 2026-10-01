import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { test } from "vitest";
import type { SharedCleanupFailurePhase } from "../ci/fixtures/shared-cleanup-failure-reporter";
import { createTestPrisma } from "../shared/prisma";

const execute = promisify(execFile);
const require = createRequire(import.meta.url);
const timeoutMessage =
  'Test timed out in 5000ms.\nIf this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".';
type ErrorTree = { name: string; message: string; errors?: ErrorTree[] };
const errorLeaf = (message: string): ErrorTree => ({ name: "Error", message });
const nodeCleanupError = (message: string): ErrorTree => ({
  name: "AggregateError",
  message: "Node runtime cleanup failed",
  errors: [errorLeaf(message)],
});
const protocolRuntimeErrors = [
  nodeCleanupError("SHARED-WORKFLOW-CANCEL"),
  nodeCleanupError("SHARED-REQUEST-CANCEL"),
];
// Vitest flattens only the aggregate passed directly to failTask. Nested
// Node runtime aggregates retain their original name, message and children.
const expectedNativeErrors: Record<SharedCleanupFailurePhase, ErrorTree[]> = {
  node: [errorLeaf("SHARED-NODE-CANCEL")],
  domain: [nodeCleanupError("SHARED-DOMAIN-CANCEL")],
  http: [...protocolRuntimeErrors, errorLeaf("SHARED-HTTP-CLOSE")],
  mcp: [
    errorLeaf("SHARED-BODY"),
    ...protocolRuntimeErrors,
    errorLeaf("SHARED-FIRST-CLOSE"),
    errorLeaf("SHARED-SECOND-CLOSE"),
  ],
  "graphql-workspace": [
    ...protocolRuntimeErrors,
    errorLeaf("SHARED-WORKSPACE-OWNER-CLOSE"),
    errorLeaf("SHARED-WORKSPACE-OTHER-CLOSE"),
  ],
  "graphql-workspace-timeout": [errorLeaf(timeoutMessage)],
  "graphql-workspace-setup-timeout": [errorLeaf(timeoutMessage)],
  graphql: [...protocolRuntimeErrors, errorLeaf("SHARED-GRAPHQL-CLOSE")],
  comment: [...protocolRuntimeErrors, errorLeaf("SHARED-COMMENT-CLOSE")],
  public: [...protocolRuntimeErrors, errorLeaf("SHARED-PUBLIC-CLOSE")],
  subscription: [
    ...protocolRuntimeErrors,
    errorLeaf("SHARED-SUBSCRIPTION-CLOSE"),
  ],
  "http-timeout": [errorLeaf(timeoutMessage)],
  metrics: [...protocolRuntimeErrors],
  "metrics-timeout": [errorLeaf(timeoutMessage)],
  catalog: [...protocolRuntimeErrors],
  "catalog-timeout": [errorLeaf(timeoutMessage)],
  "catalog-setup-timeout": [errorLeaf(timeoutMessage)],
  discovery: [...protocolRuntimeErrors],
  oauth: [...protocolRuntimeErrors],
  cimd: [errorLeaf("SHARED-BODY"), ...protocolRuntimeErrors],
};
function errorLeaves(error: ErrorTree): ErrorTree[] {
  return error.errors ? error.errors.flatMap(errorLeaves) : [error];
}

type Event = {
  event: string;
  at: number;
  sequence: number;
  runtime?: number;
  errorId?: number;
  error?: ErrorTree;
};
async function refused(origin: string) {
  const url = new URL(origin);
  return new Promise<string>((resolve, reject) => {
    const socket = createConnection({
      host: url.hostname,
      port: Number(url.port),
    });
    socket.once("connect", () => {
      socket.destroy();
      reject(new Error("Owned HTTP listener is still accepting connections"));
    });
    socket.once("error", (error: NodeJS.ErrnoException) => {
      socket.destroy();
      resolve(error.code ?? "");
    });
    socket.setTimeout(1_000, () => {
      socket.destroy();
      reject(new Error("HTTP listener absence check timed out"));
    });
  });
}

test.for<SharedCleanupFailurePhase>([
  "node",
  "domain",
  "http",
  "mcp",
  "graphql",
  "graphql-workspace",
  "graphql-workspace-timeout",
  "graphql-workspace-setup-timeout",
  "comment",
  "public",
  "subscription",
  "http-timeout",
  "metrics",
  "metrics-timeout",
  "catalog",
  "catalog-timeout",
  "catalog-setup-timeout",
  "discovery",
  "oauth",
  "cimd",
])(
  "native %s cleanup reports each original error once and releases owned resources",
  async (phase, { expect, annotate }) => {
    const output = await mkdtemp(join(tmpdir(), "life-ustc-shared-cleanup-"));
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
            "tests/ci/fixtures/shared-cleanup-failure.config.ts",
          ],
          {
            cwd: resolve("."),
            env: {
              ...process.env,
              SHARED_CLEANUP_PROBE_PHASE: phase,
              SHARED_CLEANUP_PROBE_OUTPUT: output,
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
      const load = async (file: string) =>
        JSON.parse(await readFile(join(output, file), "utf8"));
      async function assertSiblingCancellation() {
        const work = await load("sibling-work.json");
        expect(work.written).toEqual({
          id: expect.any(String),
          userId: "shared-cleanup-owner",
          title: "Sibling cancellation completed",
        });
        expect(work.persisted).toEqual(work.written);
      }
      const report = await load("report.json");
      const native = await load("native-result.json");
      const resources = (await load("resources.json")) as {
        template: string;
        database: string;
        directory: string;
        processes: number[];
        childPid: number;
        todo: { id: string; userId: string; title: string };
      };
      const parseEvents = async (file: string) =>
        (await readFile(join(output, file), "utf8"))
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line) as Event);
      const events = await parseEvents("phases.jsonl");
      const runtime = await parseEvents("runtime.jsonl");
      const names = events.map((e) => e.event);
      expect(exitCode).toBe(1);
      expect(report).toMatchObject({
        success: false,
        numTotalTests: 1,
        numFailedTests: 1,
        numPassedTests: 0,
        numPendingTests: 0,
      });
      expect(report.testResults).toHaveLength(1);
      expect(report.testResults[0].message).toBe("");
      expect(report.testResults[0].assertionResults).toHaveLength(1);
      expect(await load("native-run-errors.json")).toEqual([]);
      expect(native).toMatchObject({
        title:
          "native shared cleanup preserves failures and releases owned state",
        state: "failed",
      });
      expect(native.errors).toEqual(expectedNativeErrors[phase]);
      const leaves = (native.errors as ErrorTree[]).flatMap(errorLeaves);
      const expectedLeaves = expectedNativeErrors[phase].flatMap(errorLeaves);
      expect(leaves).toEqual(expectedLeaves);
      for (const { message } of expectedLeaves)
        expect(
          leaves.filter((error) => error.message === message),
        ).toHaveLength(1);
      expect(
        (await readFile(join(output, "runner.log"), "utf8")).trim(),
      ).not.toBe("");
      expect(resources.todo).toEqual({
        id: expect.any(String),
        userId: "shared-cleanup-owner",
        title: "Committed shared cleanup state",
      });
      expect(names[0]).toBe("state-committed");
      expect(
        names.filter((name) => name === "database-dispose-start"),
      ).toHaveLength(1);
      expect(
        names.filter((name) => name === "database-dispose-finished"),
      ).toHaveLength(1);
      expect(names.at(-1)).toBe("database-dispose-finished");
      const disposal = events.find(
        (event) => event.event === "database-dispose-start",
      );
      if (!disposal) throw new Error("Missing database disposal evidence");
      expect(events.at(-1)?.at).toBeLessThanOrEqual(native.at);
      expect(runtime.length).toBeGreaterThan(0);
      for (const id of new Set(runtime.map((event) => event.runtime))) {
        const starts = runtime.filter(
          (event) =>
            event.runtime === id && event.event === "runtime-close-start",
        );
        const finishes = runtime.filter(
          (event) =>
            event.runtime === id && event.event === "runtime-close-finished",
        );
        expect(starts.length).toBeGreaterThan(0);
        expect(finishes).toHaveLength(starts.length);
        for (const event of finishes) {
          expect(event.at).toBeLessThanOrEqual(disposal.at);
          expect(event.sequence).toBeLessThan(disposal.sequence);
        }
      }
      const errors = runtime.filter((event) => event.event === "runtime-error");
      if (
        phase === "graphql-workspace-setup-timeout" ||
        phase === "graphql-workspace-timeout"
      ) {
        expect(errors).toEqual([]);
        expect(
          names.filter((name) => name === "native-test-aborted"),
        ).toHaveLength(1);
        const observation =
          phase === "graphql-workspace-setup-timeout"
            ? "graphql-workspace-setup-observed"
            : "graphql-workspace-body-finally";
        if (phase === "graphql-workspace-setup-timeout") {
          expect(names).not.toContain("body-entered");
          const order = [
            "state-committed",
            "graphql-workspace-setup-entered",
            "native-test-aborted",
            "graphql-workspace-setup-resumed",
            "workspace-owner-initialized",
            "workspace-other-initialized",
            observation,
          ];
          for (let index = 1; index < order.length; index++)
            expect(names.indexOf(order[index])).toBeGreaterThan(
              names.indexOf(order[index - 1]),
            );
          const setup = await load("late-graphql-workspace-setup.json");
          expect(setup).toMatchObject({
            nativeAborted: true,
            courses: 1,
            sections: 1,
            homework: 4,
            users: 2,
            result: {
              success: true,
              data: {
                workspace: {
                  subscribedSections: { items: [], pageInfo: { total: 0 } },
                },
              },
            },
          });
        } else {
          const order = [
            "state-committed",
            "body-entered",
            "graphql-workspace-before-read",
            "native-test-aborted",
            "graphql-workspace-late-write-finished",
            "graphql-workspace-late-read-finished",
            observation,
          ];
          for (let index = 1; index < order.length; index++)
            expect(names.indexOf(order[index])).toBeGreaterThan(
              names.indexOf(order[index - 1]),
            );
          const work = await load("late-graphql-workspace-work.json");
          expect(work.nativeAborted).toBe(true);
          expect(work.before).toMatchObject({
            success: true,
            data: {
              workspace: {
                subscribedSections: {
                  items: [{ kind: "regular" }],
                  pageInfo: { total: 1 },
                },
              },
            },
          });
          expect(work.changed).toMatchObject({
            success: true,
            data: { subscriptionKindUpdate: { kind: "auditor" } },
          });
          expect(work.after).toMatchObject({
            success: true,
            data: {
              workspace: {
                subscribedSections: {
                  items: [{ kind: "auditor" }],
                  pageInfo: { total: 1 },
                },
              },
            },
          });
          expect(work.persisted).toEqual([
            { userId: "graphql-domain-owner", kind: "auditor" },
          ]);
        }
        for (const client of ["workspace-owner", "workspace-other"]) {
          expect(
            names.filter((name) => name === `${client}-close-start`),
          ).toHaveLength(1);
          expect(
            names.filter((name) => name === `${client}-close-finished`),
          ).toHaveLength(1);
          expect(names.indexOf(`${client}-close-start`)).toBeGreaterThan(
            names.indexOf(observation),
          );
          expect(names.indexOf(`${client}-close-finished`)).toBeGreaterThan(
            names.indexOf(`${client}-close-start`),
          );
          expect(names.indexOf(`${client}-close-finished`)).toBeLessThan(
            names.indexOf("database-dispose-start"),
          );
        }
      } else if (phase === "metrics-timeout") {
        expect(errors).toEqual([]);
        expect(names).toEqual([
          "state-committed",
          "body-entered",
          "metrics-lock-acquired",
          "metrics-scrape-entered",
          "native-test-aborted",
          "metrics-scrape-resumed",
          "metrics-scrape-consumed",
          "metrics-lock-released",
          "metrics-late-work-finished",
          "database-dispose-start",
          "database-dispose-finished",
        ]);
        const work = await load("late-metrics-work.json");
        expect(work.nativeAborted).toBe(true);
        expect(work.status).toBe(503);
        expect(work.body).toBe("Metrics unavailable\n");
        expect(work.event).toEqual({ id: expect.any(String), durationMs: 7 });
        expect(work.persisted).toEqual(work.event);
        expect(work.features).toEqual([
          {
            feature: "catalog.search",
            operation: "search",
            protocol: "rest",
            surface: "unknown",
            authMode: "anonymous",
            outcome: "success",
            events: 1,
          },
        ]);
        expect(work.recoveredStatus).toBe(200);
        expect(work.recoveredBody).toContain("# TYPE life_ustc_users gauge\n");
      } else if (phase === "catalog-setup-timeout") {
        expect(errors).toEqual([]);
        expect(names).toEqual([
          "state-committed",
          "catalog-setup-entered",
          "native-test-aborted",
          "catalog-setup-resumed",
          "catalog-setup-observed",
          "database-dispose-start",
          "database-dispose-finished",
        ]);
        expect(names).not.toContain("body-entered");
        const setup = await load("late-catalog-setup.json");
        expect(setup.actualInvocations).toBe(1);
        expect(setup.nativeAborted).toBe(true);
        expect(setup.revision.snapshotSha256).toMatch(/^[0-9a-f]{64}$/);
        expect(setup.counts).toEqual({
          semesters: 1,
          departments: 2,
          titles: 2,
          teachers: 2,
          courses: 2,
          sections: 2,
        });
        expect(setup.sections).toHaveLength(2);
        expect(setup.sections).toEqual(setup.expectedSections);
      } else if (phase === "catalog-timeout") {
        expect(errors).toEqual([]);
        expect(names).toEqual([
          "state-committed",
          "body-entered",
          "catalog-mutation-finished",
          "native-test-aborted",
          "catalog-late-write-finished",
          "catalog-revision-finished",
          "catalog-late-read-finished",
          "catalog-workflow-finally",
          "database-dispose-start",
          "database-dispose-finished",
        ]);
        const work = await load("late-catalog-work.json");
        expect(work.nativeAborted).toBe(true);
        expect(work.beforeName).toBe(work.originalName);
        expect(work.originalName).toEqual(expect.any(String));
        expect(work.updatedName).toBe("Catalog updated before native timeout");
        expect(work.createdName).toBe("Catalog created after native timeout");
        expect(work.created).toEqual({
          id: expect.any(Number),
          jwId: expect.any(Number),
          nameCn: "Catalog created after native timeout",
        });
        expect(work.persisted).toEqual(work.created);
        expect(work.revisionBefore).toMatch(/^[0-9a-f]{64}$/);
        expect(work.revisionAfter).toMatch(/^[0-9a-f]{64}$/);
        expect(work.revisionAfter).not.toBe(work.revisionBefore);
      } else if (phase === "metrics" || phase === "catalog") {
        expect(errors.map((event) => event.error)).toEqual(
          protocolRuntimeErrors,
        );
        expect(new Set(errors.map((event) => event.errorId)).size).toBe(2);
        expect(new Set(errors.map((event) => event.runtime)).size).toBe(2);
        expect(names).toEqual([
          "state-committed",
          "body-finished",
          "workflow-cancel",
          "request-cancel",
          "sibling-cancel-finished",
          "database-dispose-start",
          "database-dispose-finished",
        ]);
        await assertSiblingCancellation();
      } else if (phase === "http-timeout") {
        expect(errors).toEqual([]);
        expect(
          names.filter((name) => name === "native-test-aborted"),
        ).toHaveLength(1);
        const order = [
          "body-entered",
          "native-test-aborted",
          "late-http-start",
          "late-http-write-finished",
          "late-http-consumed",
          "http-close-finished",
          "database-dispose-start",
          "database-dispose-finished",
        ];
        for (let i = 1; i < order.length; i++)
          expect(names.indexOf(order[i])).toBeGreaterThan(
            names.indexOf(order[i - 1]),
          );
        const work = await load("late-http-work.json");
        expect(work.nativeAborted).toBe(true);
        expect(work.written).toEqual({
          id: expect.any(String),
          userId: "shared-cleanup-owner",
          title: "Actual HTTP write after native timeout",
        });
        expect(work.persisted).toEqual(work.written);
      } else if (phase === "node" || phase === "domain") {
        expect(errors).toHaveLength(1);
        expect(errors[0].error).toEqual({
          name: "AggregateError",
          message: "Node runtime cleanup failed",
          errors: [
            { name: "Error", message: `SHARED-${phase.toUpperCase()}-CANCEL` },
          ],
        });
        expect(names.filter((name) => name === `${phase}-cancel`)).toHaveLength(
          1,
        );
        expect(
          names.filter((name) => name === "sibling-cancel-finished"),
        ).toHaveLength(1);
        expect(names.indexOf("sibling-cancel-finished")).toBeLessThan(
          names.indexOf("database-dispose-start"),
        );
        await assertSiblingCancellation();
      } else if (["discovery", "oauth", "cimd"].includes(phase)) {
        expect(errors.map((event) => event.error)).toEqual(
          protocolRuntimeErrors,
        );
        expect(new Set(errors.map((event) => event.errorId)).size).toBe(2);
        expect(new Set(errors.map((event) => event.runtime)).size).toBe(2);
        // Each physical owner closes once; the CIMD borrower awaits the same
        // cached provider close before its enclosing owner reports that failure.
        expect(runtime.map((event) => event.event)).toEqual([
          "runtime-close-start",
          "runtime-error",
          "runtime-close-finished",
          "runtime-close-start",
          "runtime-error",
          "runtime-close-finished",
        ]);
        expect(names).toEqual([
          "state-committed",
          phase === "cimd" ? "body-rejected" : "body-finished",
          "workflow-cancel",
          "request-cancel",
          "sibling-cancel-finished",
          "globals-observed-before-dispose",
          "database-dispose-start",
          "database-dispose-finished",
        ]);
        for (const stage of ["workflow", "request", "sibling"])
          expect(await load(`globals-${stage}.json`)).toEqual({
            date: phase !== "discovery",
            fetch: phase !== "cimd",
            caches: phase !== "discovery",
          });
        expect(await load("globals-before-dispose.json")).toEqual({
          date: true,
          fetch: true,
          caches: true,
        });
        await assertSiblingCancellation();
      } else {
        const workflow = errors.filter(
          (event) =>
            event.error?.errors?.[0]?.message === "SHARED-WORKFLOW-CANCEL",
        );
        const request = errors.filter(
          (event) =>
            event.error?.errors?.[0]?.message === "SHARED-REQUEST-CANCEL",
        );
        expect(workflow).toHaveLength(phase === "subscription" ? 3 : 2);
        expect(new Set(workflow.map((event) => event.errorId)).size).toBe(1);
        expect(new Set(workflow.map((event) => event.runtime)).size).toBe(1);
        expect(request).toHaveLength(1);
        expect(errors).toHaveLength(workflow.length + request.length);
        for (const [label, group] of [
          ["WORKFLOW", workflow],
          ["REQUEST", request],
        ] as const)
          for (const event of group)
            expect(event.error).toEqual({
              name: "AggregateError",
              message: "Node runtime cleanup failed",
              errors: [{ name: "Error", message: `SHARED-${label}-CANCEL` }],
            });
        expect(names.filter((name) => name === "workflow-cancel")).toHaveLength(
          1,
        );
        expect(names.filter((name) => name === "request-cancel")).toHaveLength(
          1,
        );
        const clients =
          phase === "graphql-workspace"
            ? ["workspace-owner", "workspace-other"]
            : phase === "mcp"
              ? ["first", "second"]
              : phase === "http"
                ? []
                : [phase];
        for (const client of clients) {
          expect(
            names.filter((name) => name === `${client}-close-start`),
          ).toHaveLength(1);
          expect(
            names.filter((name) => name === `${client}-close-finished`),
          ).toHaveLength(1);
          expect(names.indexOf(`${client}-close-finished`)).toBeGreaterThan(
            names.indexOf(`${client}-close-start`),
          );
          expect(names.indexOf(`${client}-close-finished`)).toBeLessThan(
            names.indexOf("database-dispose-start"),
          );
          expect(await load(`${client}-error.json`)).toEqual({
            name: "Error",
            message: `SHARED-${client.toUpperCase()}-CLOSE`,
          });
        }
      }
      if (["http", "subscription", "http-timeout"].includes(phase)) {
        expect(
          names.filter((name) => name === "http-close-start"),
        ).toHaveLength(1);
        expect(
          names.filter((name) => name === "http-close-finished"),
        ).toHaveLength(1);
        expect(names.indexOf("http-close-finished")).toBeLessThan(
          names.indexOf("database-dispose-start"),
        );
        expect(await refused((await load("http.json")).origin)).toBe(
          "ECONNREFUSED",
        );
      }
      const connection = new URL(process.env.FUNCTION_OWNER_DATABASE_URL ?? "");
      connection.pathname = "/postgres";
      const observer = createTestPrisma(connection.href);
      const databases = [resources.template, resources.database];
      expect(new Set(databases).size).toBe(2);
      for (const database of databases)
        expect(database).toMatch(/^test_isolated_[0-9a-f]{32}$/);
      try {
        expect(
          await observer.$queryRawUnsafe(
            "SELECT datname FROM pg_database WHERE datname = ANY($1::text[])",
            databases,
          ),
        ).toEqual([]);
        expect(
          await observer.$queryRawUnsafe(
            "SELECT datname FROM pg_stat_activity WHERE datname = ANY($1::text[]) OR application_name = ANY($1::text[])",
            databases,
          ),
        ).toEqual([]);
      } finally {
        await observer.$disconnect();
      }
      expect(existsSync(resources.directory)).toBe(false);
      expect(resources.processes.length).toBeGreaterThan(0);
      for (const pid of [...resources.processes, resources.childPid]) {
        let code: string | undefined;
        try {
          process.kill(pid, 0);
        } catch (error) {
          code = (error as NodeJS.ErrnoException).code;
        }
        expect(code).toBe("ESRCH");
      }
      await annotate("Native shared cleanup ownership verified", {
        contentType: "application/json",
        bodyEncoding: "utf-8",
        body: JSON.stringify({ phase, native, resources, events, runtime }),
      });
      passed = true;
    } finally {
      if (passed) await rm(output, { recursive: true, force: true });
      else console.error(`Native shared cleanup failure evidence: ${output}`);
    }
  },
);
