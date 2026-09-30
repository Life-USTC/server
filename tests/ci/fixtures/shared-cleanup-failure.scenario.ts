import { appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { vi } from "vitest";
import { getCoursePage } from "@/features/catalog/server/course-page-data";
import { findCourseDetailByJwId } from "@/features/catalog/server/course-section-read-queries";
import { withUserDbContext } from "@/lib/db/prisma";
import { catalogReadTest } from "../../shared/catalog-read-fixture";
import { commentReadTest } from "../../shared/comment-read-contract-fixture";
import { createDeferred } from "../../shared/deferred";
import { domainStateTest } from "../../shared/domain-state-fixture";
import { graphqlMutationTest } from "../../shared/graphql-mutation-fixture";
import type {
  IsolatedDatabase,
  OwnedDatabase,
  OwnedDatabaseTemplate,
} from "../../shared/isolated-database-lifecycle";
import { isolatedNodeTest } from "../../shared/isolated-node-fixture";
import { mcpProtocolTest } from "../../shared/mcp-protocol-fixture";
import { metricsTest } from "../../shared/metrics-fixture";
import { nodeHttpTest } from "../../shared/node-http-contract-fixture";
import type { NodeProtocolRuntime } from "../../shared/node-protocol-runtime";
import { publicCatalogProtocolTest } from "../../shared/public-catalog-protocol-fixture";
import { restSubscriptionTest } from "../../shared/rest-subscription-contract-fixture";
import {
  errorTree,
  type SharedCleanupFailurePhase,
} from "./shared-cleanup-failure-reporter";

// Observe real runtime closures; never replace their work or returned errors.
const runtimeJournal = await vi.hoisted(async () => {
  const { appendFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { errorTree } = await import("./shared-cleanup-failure-reporter");
  const output = process.env.SHARED_CLEANUP_PROBE_OUTPUT;
  if (!output) throw new Error("Missing shared cleanup output");
  const journalOutput = output;
  const { createDeferred } = await import("../../shared/deferred");
  const metricsGate = createDeferred();
  const ids = new WeakMap<object, number>();
  let nextError = 0;
  let nextRuntime = 0;
  let sequence = 0;
  // Discovery intentionally replaces Date; journal ordering uses the original clock.
  const now = Date.now.bind(Date);
  function record(value: Record<string, unknown>) {
    appendFileSync(
      join(journalOutput, "runtime.jsonl"),
      `${JSON.stringify({ at: now(), sequence: ++sequence, ...value })}\n`,
    );
  }
  return {
    metricsGate,
    now,
    next: () => ++nextRuntime,
    tick: () => ++sequence,
    record,
    failure(runtime: number, error: unknown) {
      if (!error || typeof error !== "object")
        throw new Error("Expected runtime error object");
      if (!ids.has(error)) ids.set(error, ++nextError);
      record({
        event: "runtime-error",
        runtime,
        errorId: ids.get(error),
        error: errorTree(error),
      });
    },
  };
});
vi.mock("../../shared/node-runtime", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../shared/node-runtime")>();
  return {
    ...actual,
    createNodeRuntime(...args: Parameters<typeof actual.createNodeRuntime>) {
      const runtime = actual.createNodeRuntime(...args);
      const id = runtimeJournal.next();
      const close = runtime.close;
      runtime.close = async () => {
        runtimeJournal.record({ event: "runtime-close-start", runtime: id });
        try {
          await close();
        } catch (error) {
          runtimeJournal.failure(id, error);
          throw error;
        } finally {
          runtimeJournal.record({
            event: "runtime-close-finished",
            runtime: id,
          });
        }
      };
      return runtime;
    },
  };
});

// Delay the actual route across native timeout, or fail cancellation only after
// its real response body has released its resources. Route behavior stays real.
vi.mock("@/routes/metrics/+server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/routes/metrics/+server")>();
  return {
    ...actual,
    GET: async (...args: Parameters<typeof actual.GET>) => {
      const phase = process.env.SHARED_CLEANUP_PROBE_PHASE;
      if (phase === "metrics-timeout") {
        record("metrics-scrape-entered");
        await runtimeJournal.metricsGate.promise;
        record("metrics-scrape-resumed");
      }
      const response = await actual.GET(...args);
      if (phase !== "metrics" || !response.body) return response;
      const reader = response.body.getReader();
      return new Response(
        new ReadableStream({
          async pull(controller) {
            const result = await reader.read();
            if (result.done) controller.close();
            else controller.enqueue(result.value);
          },
          async cancel(reason) {
            await reader.cancel(reason);
            record("request-cancel");
            const error = new Error("SHARED-REQUEST-CANCEL");
            save("request-error.json", errorTree(error));
            throw error;
          },
        }),
        response,
      );
    },
  };
});

const inputPhase = process.env.SHARED_CLEANUP_PROBE_PHASE;
const output = process.env.SHARED_CLEANUP_PROBE_OUTPUT;
if (
  !output ||
  ![
    "node",
    "domain",
    "http",
    "mcp",
    "graphql",
    "comment",
    "public",
    "subscription",
    "http-timeout",
    "metrics",
    "metrics-timeout",
    "catalog",
    "catalog-timeout",
    "discovery",
    "oauth",
    "cimd",
  ].includes(inputPhase ?? "")
)
  throw new Error("Missing shared cleanup phase/output");
const phase = inputPhase as SharedCleanupFailurePhase;
const probeOutput = output;
const originalGlobals = {
  date: globalThis.Date,
  fetch: globalThis.fetch,
  caches: Object.getOwnPropertyDescriptor(globalThis, "caches"),
};
function saveGlobals(stage: string) {
  const caches = Object.getOwnPropertyDescriptor(globalThis, "caches");
  save(`globals-${stage}.json`, {
    date: globalThis.Date === originalGlobals.date,
    fetch: globalThis.fetch === originalGlobals.fetch,
    caches:
      caches?.value === originalGlobals.caches?.value &&
      caches?.get === originalGlobals.caches?.get &&
      caches?.set === originalGlobals.caches?.set &&
      caches?.enumerable === originalGlobals.caches?.enumerable &&
      caches?.configurable === originalGlobals.caches?.configurable &&
      caches?.writable === originalGlobals.caches?.writable,
  });
}
const title =
  "native shared cleanup preserves failures and releases owned state";
function record(event: string, values: Record<string, unknown> = {}) {
  appendFileSync(
    join(probeOutput, "phases.jsonl"),
    `${JSON.stringify({ event, at: runtimeJournal.now(), sequence: runtimeJournal.tick(), ...values })}\n`,
  );
}
function save(name: string, value: unknown) {
  writeFileSync(join(probeOutput, name), JSON.stringify(value));
}
async function prepareProbe({
  isolatedDatabase,
  _templateResources,
  _databaseResources,
}: {
  isolatedDatabase: IsolatedDatabase;
  _templateResources: OwnedDatabaseTemplate;
  _databaseResources: OwnedDatabase;
}) {
  const userId = "shared-cleanup-owner";
  const todo = await isolatedDatabase.owner.$transaction(async (db) => {
    await db.user.create({
      data: {
        id: userId,
        email: "shared-cleanup@example.test",
        name: "Shared cleanup owner",
      },
    });
    return db.todo.create({
      data: { userId, title: "Committed shared cleanup state" },
      select: { id: true, userId: true, title: true },
    });
  });
  save("resources.json", {
    ..._templateResources.state(),
    database: isolatedDatabase.name,
    childPid: process.pid,
    todo,
  });
  record("state-committed");
  const dispose = _databaseResources.dispose;
  _databaseResources.dispose = async () => {
    if (["discovery", "oauth", "cimd"].includes(phase)) {
      saveGlobals("before-dispose");
      record("globals-observed-before-dispose");
    }
    record("database-dispose-start");
    await dispose();
    record("database-dispose-finished");
  };
  return { db: isolatedDatabase.owner, userId };
}
type Probe = Awaited<ReturnType<typeof prepareProbe>>;
function cancellation(label: string, observe?: () => void) {
  return new Response(
    new ReadableStream({
      cancel() {
        observe?.();
        record(`${label}-cancel`);
        const error = new Error(`SHARED-${label.toUpperCase()}-CANCEL`);
        save(`${label}-error.json`, errorTree(error));
        throw error;
      },
    }),
  );
}
async function prepareProtocolFailures(runtime: NodeProtocolRuntime) {
  await runtime.run(() => cancellation("workflow"));
  await runtime.request(() => cancellation("request"));
}
function failClientClose(client: { close(): Promise<void> }, label: string) {
  const close = client.close;
  client.close = async () => {
    record(`${label}-close-start`);
    await close();
    record(`${label}-close-finished`);
    const error = new Error(`SHARED-${label.toUpperCase()}-CLOSE`);
    save(`${label}-error.json`, errorTree(error));
    throw error;
  };
}
function observeHttp(
  http: { origin: string; close(): Promise<void> },
  fail: boolean,
) {
  save("http.json", { origin: http.origin });
  const close = http.close;
  http.close = async () => {
    record("http-close-start");
    await close();
    record("http-close-finished");
    if (fail) {
      const error = new Error("SHARED-HTTP-CLOSE");
      save("http-error.json", errorTree(error));
      throw error;
    }
  };
}
async function successfulCancellation(probe: Probe) {
  const written = await probe.db.todo.create({
    data: { userId: probe.userId, title: "Sibling cancellation completed" },
    select: { id: true, userId: true, title: true },
  });
  const persisted = await probe.db.todo.findUniqueOrThrow({
    where: { id: written.id },
    select: { id: true, userId: true, title: true },
  });
  save("sibling-work.json", { written, persisted });
  record("sibling-cancel-finished");
}

if (phase === "node") {
  isolatedNodeTest.extend("probe", prepareProbe)(
    title,
    async ({ probe, nodeRuntime }) => {
      await nodeRuntime.run(() => cancellation("node"));
      await nodeRuntime.run(
        () =>
          new Response(
            new ReadableStream({ cancel: () => successfulCancellation(probe) }),
          ),
      );
      record("body-finished");
    },
  );
}
if (phase === "domain") {
  domainStateTest.extend("probe", prepareProbe)(
    title,
    async ({ probe, domainRuntime }) => {
      await domainRuntime(async () => cancellation("domain"));
      await domainRuntime(
        async () =>
          new Response(
            new ReadableStream({ cancel: () => successfulCancellation(probe) }),
          ),
      );
      record("body-finished");
    },
  );
}
if (phase === "http") {
  nodeHttpTest.extend("probe", prepareProbe).extend({
    // biome-ignore lint/correctness/noEmptyPattern: Vitest parses fixture dependencies.
    httpHandler: async ({}, use) => {
      await use(() => new Response("actual HTTP response"));
    },
  })(title, async ({ probe, protocolRuntime, http, expect }) => {
    expect(await probe.db.todo.count()).toBe(1);
    observeHttp(http, true);
    expect(await (await http.fetch(http.origin)).text()).toBe(
      "actual HTTP response",
    );
    await prepareProtocolFailures(protocolRuntime);
    record("body-finished");
  });
}
if (phase === "mcp") {
  mcpProtocolTest.extend("probe", prepareProbe)(
    title,
    async ({ probe, protocolRuntime, mcpSessions }) => {
      const first = await mcpSessions.createMcpHarness(probe.userId);
      const second = await mcpSessions.createAnonymousMcpHarness();
      failClientClose(first, "first");
      failClientClose(second, "second");
      await prepareProtocolFailures(protocolRuntime);
      record("body-rejected");
      throw new Error("SHARED-BODY");
    },
  );
}
if (phase === "graphql") {
  graphqlMutationTest.extend("probe", prepareProbe)(
    title,
    async ({ probe, protocolRuntime, graphql, expect }) => {
      expect(await probe.db.user.count({ where: { id: graphql.userId } })).toBe(
        1,
      );
      failClientClose(graphql.mcp, "graphql");
      await prepareProtocolFailures(protocolRuntime);
      record("body-finished");
    },
  );
}
if (phase === "comment") {
  commentReadTest.extend("probe", prepareProbe)(
    title,
    async ({ probe, protocolRuntime, readSdk, expect }) => {
      expect(await probe.db.todo.count()).toBe(1);
      const owned = readSdk.own(null);
      await owned.initialize();
      failClientClose(owned.client, "comment");
      await prepareProtocolFailures(protocolRuntime);
      record("body-finished");
    },
  );
}
if (phase === "public") {
  publicCatalogProtocolTest.extend("probe", prepareProbe)(
    title,
    async ({ probe, protocolRuntime, publicCatalogMcp, expect }) => {
      expect(await probe.db.todo.count()).toBe(1);
      await publicCatalogMcp.initialize();
      failClientClose(publicCatalogMcp.client, "public");
      await prepareProtocolFailures(protocolRuntime);
      record("body-finished");
    },
  );
}
if (phase === "subscription") {
  restSubscriptionTest.extend("probe", prepareProbe)(
    title,
    async ({ probe, protocolRuntime, subscription, http, expect }) => {
      expect(await probe.db.todo.count()).toBe(1);
      observeHttp(http, false);
      const actor = await subscription.user();
      const client = await subscription.createMcpHarness(actor.id);
      failClientClose(client, "subscription");
      await prepareProtocolFailures(protocolRuntime);
      record("body-finished");
    },
  );
}

if (phase === "catalog") {
  catalogReadTest.extend("probe", prepareProbe)(
    title,
    async ({ probe, catalogRead, expect }) => {
      await catalogRead.run(async () => {
        const course = catalogRead.fixture.courses[0];
        const detail = await catalogRead.request(() =>
          findCourseDetailByJwId(course.jwId),
        );
        expect(detail?.namePrimary).toBe(course.nameCn);
        await catalogRead.request(
          () =>
            new Response(
              new ReadableStream({
                cancel: () => successfulCancellation(probe),
              }),
            ),
        );
      });
      await catalogRead.run(() => cancellation("workflow"));
      await catalogRead.request(() => cancellation("request"));
      record("body-finished");
    },
  );
}
if (phase === "catalog-timeout") {
  catalogReadTest.extend("probe", prepareProbe)(
    title,
    { timeout: 5_000 },
    async ({ probe: _probe, catalogRead, signal }) => {
      const gate = createDeferred();
      signal.addEventListener(
        "abort",
        () => {
          record("native-test-aborted");
          gate.resolve();
        },
        { once: true },
      );
      await catalogRead.run(async () => {
        record("body-entered");
        const { db, fixture, request, commitRevision } = catalogRead;
        const course = fixture.courses[0];
        const revisionBefore = await db.staticImportState.findUniqueOrThrow({
          where: { id: "global" },
          select: { snapshotSha256: true },
        });
        const before = await request(() =>
          findCourseDetailByJwId(course.jwId),
        );
        try {
          await db.course.update({
            where: { id: course.id },
            data: { nameCn: "Catalog updated before native timeout" },
          });
          record("catalog-mutation-finished");
          await gate.promise;
          const created = await db.course.create({
            data: {
              jwId: fixture.base + 99,
              code: "CATALOG-AFTER-TIMEOUT",
              nameCn: "Catalog created after native timeout",
            },
            select: { id: true, jwId: true, nameCn: true },
          });
          record("catalog-late-write-finished");
          await commitRevision();
          record("catalog-revision-finished");
          const updatedPage = await request(() =>
            getCoursePage(course.jwId),
          );
          const createdDetail = await request(() =>
            findCourseDetailByJwId(created.jwId),
          );
          const persisted = await db.course.findUniqueOrThrow({
            where: { id: created.id },
            select: { id: true, jwId: true, nameCn: true },
          });
          const revisionAfter = await db.staticImportState.findUniqueOrThrow({
            where: { id: "global" },
            select: { snapshotSha256: true },
          });
          save("late-catalog-work.json", {
            nativeAborted: signal.aborted,
            originalName: course.nameCn,
            beforeName: before?.namePrimary,
            updatedName: updatedPage?.namePrimary,
            createdName: createdDetail?.namePrimary,
            created,
            persisted,
            revisionBefore: revisionBefore.snapshotSha256,
            revisionAfter: revisionAfter.snapshotSha256,
          });
          record("catalog-late-read-finished");
        } finally {
          record("catalog-workflow-finally");
        }
      });
    },
  );
}

if (phase === "metrics") {
  metricsTest.extend("probe", prepareProbe)(
    title,
    async ({ probe, metrics, protocolRuntime, expect }) => {
      await metrics.run(async () => {
        const response = await metrics.scrape(
          new Request("http://localhost:3000/metrics", {
            headers: { authorization: "Bearer metrics-probe-secret" },
          }),
          "metrics-probe-secret",
        );
        expect(response.status).toBe(200);
        // Leave the real metrics body unconsumed; its cancellation will fail.
        await protocolRuntime.request(
          () =>
            new Response(
              new ReadableStream({
                cancel: () => successfulCancellation(probe),
              }),
            ),
        );
      });
      await protocolRuntime.run(() => cancellation("workflow"));
      record("body-finished");
    },
  );
}
if (phase === "metrics-timeout") {
  metricsTest.extend("probe", prepareProbe)(
    title,
    { timeout: 5_000 },
    async ({ probe, metrics, signal }) => {
      signal.addEventListener(
        "abort",
        () => {
          record("native-test-aborted");
          runtimeJournal.metricsGate.resolve();
        },
        { once: true },
      );
      await metrics.run(async () => {
        record("body-entered");
        const locked = createDeferred();
        const release = createDeferred();
        const holder = probe.db.$transaction(
          async (tx) => {
            await tx.$executeRaw`SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('life-ustc.prometheus-metrics-cache', 0))`;
            record("metrics-lock-acquired");
            locked.resolve();
            await release.promise;
          },
          { timeout: 15_000 },
        );
        let status: number;
        let body: string;
        try {
          await Promise.race([locked.promise, holder]);
          const response = await metrics.scrape(
            new Request("http://localhost:3000/metrics", {
              headers: { authorization: "Bearer metrics-timeout-secret" },
            }),
            "metrics-timeout-secret",
          );
          status = response.status;
          body = await response.text();
          record("metrics-scrape-consumed");
        } finally {
          release.resolve();
          await holder;
          record("metrics-lock-released");
        }
        const event = {
          id: crypto.randomUUID(),
          feature: "catalog.search",
          operation: "search",
          protocol: "rest",
          surface: "unknown",
          authMode: "anonymous",
          outcome: "success",
          errorClass: "none",
          durationMs: 7,
        };
        await metrics.write({ features: [event] });
        const snapshot = await metrics.read();
        const persisted =
          await probe.db.featureOperationEvent.findUniqueOrThrow({
            where: { id: event.id },
            select: { id: true, durationMs: true },
          });
        const recovered = await metrics.serve(
          new Request("http://localhost:3000/metrics", {
            headers: { authorization: "Bearer metrics-fixture-secret" },
          }),
        );
        const recoveredBody = await recovered.text();
        save("late-metrics-work.json", {
          nativeAborted: signal.aborted,
          status,
          body,
          event: { id: event.id, durationMs: event.durationMs },
          persisted,
          features: snapshot.features,
          recoveredStatus: recovered.status,
          recoveredBody,
        });
        record("metrics-late-work-finished");
      });
    },
  );
}

if (phase === "http-timeout") {
  const timeoutTest = nodeHttpTest.extend("probe", prepareProbe).extend({
    httpHandler: async ({ probe }, use) => {
      await use(async (request: Request) => {
        const data = (await request.json()) as { title: string };
        const written = await withUserDbContext(probe.userId, (db) =>
          db.todo.create({
            data: { userId: probe.userId, title: data.title },
            select: { id: true, userId: true, title: true },
          }),
        );
        record("late-http-write-finished");
        return Response.json(written);
      });
    },
  });
  timeoutTest(
    title,
    { timeout: 5_000 },
    async ({ probe, protocolRuntime, http, signal }) => {
      observeHttp(http, false);
      const gate = createDeferred();
      signal.addEventListener(
        "abort",
        () => {
          record("native-test-aborted");
          gate.resolve();
        },
        { once: true },
      );
      await protocolRuntime.run(async () => {
        record("body-entered");
        await gate.promise;
        record("late-http-start");
        const response = await http.fetch(http.origin, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: "Actual HTTP write after native timeout",
          }),
        });
        if (response.status !== 200)
          throw new Error(`Unexpected late HTTP status ${response.status}`);
        const written = (await response.json()) as {
          id: string;
          userId: string;
          title: string;
        };
        const persisted = await probe.db.todo.findUniqueOrThrow({
          where: { id: written.id },
          select: { id: true, userId: true, title: true },
        });
        save("late-http-work.json", {
          written,
          persisted,
          nativeAborted: signal.aborted,
        });
        record("late-http-consumed");
      });
    },
  );
}

async function prepareGlobalFailures(
  runtime: Pick<NodeProtocolRuntime, "run" | "request">,
  probe: Probe,
) {
  await runtime.run(() =>
    cancellation("workflow", () => saveGlobals("workflow")),
  );
  await runtime.request(() =>
    cancellation("request", () => saveGlobals("request")),
  );
  await runtime.request(
    () =>
      new Response(
        new ReadableStream({
          async cancel() {
            await successfulCancellation(probe);
            saveGlobals("sibling");
          },
        }),
      ),
  );
}
if (phase === "discovery") {
  const { publicDiscoveryTest } = await import(
    "../../shared/public-discovery-fixture"
  );
  publicDiscoveryTest.extend("probe", prepareProbe)(
    title,
    async ({ probe, _discoveryLifetime }) => {
      await prepareGlobalFailures(_discoveryLifetime, probe);
      record("body-finished");
    },
  );
}
if (phase === "oauth") {
  const { oauthProviderTest } = await import(
    "../../shared/oauth-provider-runtime"
  );
  oauthProviderTest.extend("probe", prepareProbe)(
    title,
    async ({ probe, oauthRuntime }) => {
      await prepareGlobalFailures(oauthRuntime, probe);
      record("body-finished");
    },
  );
}
if (phase === "cimd") {
  const { cimdTest } = await import("../../shared/oauth-cimd-fixture");
  cimdTest.extend("probe", prepareProbe)(
    title,
    async ({ probe, oauthRuntime, _cimdNetwork, expect }) => {
      // Resolve the real network fixture so its borrower cleanup runs first.
      expect(_cimdNetwork.metadataByUrl.size).toBe(0);
      await prepareGlobalFailures(oauthRuntime, probe);
      record("body-rejected");
      throw new Error("SHARED-BODY");
    },
  );
}
