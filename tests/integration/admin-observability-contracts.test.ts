import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { readPrometheusMetrics } from "@/features/admin/server/prometheus-metrics-data";
import { renderPrometheusMetrics } from "@/features/admin/server/prometheus-metrics-render";
import { writeObservabilityBatch } from "@/lib/db/feature-event-store";
import {
  collectFeatureEvent,
  identifyObservedRequest,
  identifyObservedUser,
  runWithObservability,
} from "@/lib/db/observability-context";
import { emitLog } from "@/lib/log/app-log-emitter";
import { observeHttpFeature } from "@/lib/metrics/feature-http-operation";
import { recordFeatureOperation } from "@/lib/metrics/feature-operation";
import { createFixturePrisma, createTestPrisma } from "../shared/prisma";

const db = createFixturePrisma();
const marker = crypto.randomUUID();
const userId = `observation-${marker}`;
const requestIds: string[] = [];
const eventIds: string[] = [];
const context = {
  feature: "catalog.course",
  operation: "get",
  protocol: "rest",
  surface: "unknown",
  authMode: "unknown",
} as const;
function requestId() {
  const id = crypto.randomUUID();
  requestIds.push(id);
  return id;
}
async function capture(run: () => unknown | Promise<unknown>) {
  const tasks: Promise<unknown>[] = [];
  const result = await runWithObservability(run, (task) => tasks.push(task));
  await Promise.all(tasks);
  return result;
}
beforeAll(() =>
  db.user.create({ data: { id: userId, email: `${userId}@example.test` } }),
);
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await db.featureOperationEvent.deleteMany({
    where: {
      OR: [{ requestId: { in: requestIds } }, { id: { in: eventIds } }],
    },
  });
  await db.runtimeIssueEvent.deleteMany({
    where: {
      OR: [{ requestId: { in: requestIds } }, { id: { in: eventIds } }],
    },
  });
  await db.user.deleteMany({ where: { id: userId } });
  await db.$executeRaw`DELETE FROM public."PrometheusMetricsCache"`;
  await db.$disconnect();
});

it("admin.feature-experience-telemetry", async () => {
  const id = requestId();
  await capture(() => {
    identifyObservedUser(userId, "oauth");
    for (let index = 0; index < 20; index++)
      recordFeatureOperation(
        { ...context, requestId: id },
        { outcome: "success", errorClass: "none" },
        index + 0.25,
      );
  });
  const rows = await db.featureOperationEvent.findMany({
    where: { requestId: id },
    orderBy: { durationMs: "asc" },
  });
  expect(rows).toHaveLength(20);
  for (const [index, row] of rows.entries())
    expect(row).toMatchObject({
      ...context,
      authMode: "oauth",
      userId,
      requestId: id,
      outcome: "success",
      errorClass: "none",
      durationMs: index + 0.25,
    });
  const valid = {
    id: crypto.randomUUID(),
    feature: "catalog.course",
    operation: "get",
    protocol: "rest",
    surface: "unknown",
    authMode: "anonymous",
    outcome: "success",
    errorClass: "none",
    durationMs: 1,
  };
  eventIds.push(valid.id);
  for (const field of [
    "feature",
    "operation",
    "protocol",
    "surface",
    "authMode",
    "outcome",
    "errorClass",
  ])
    await expect(
      writeObservabilityBatch({
        features: [{ ...valid, [field]: "unbounded-private-dimension" }],
      }),
    ).rejects.toThrow();
  for (const durationMs of [-1, Number.NaN, Number.POSITIVE_INFINITY])
    await expect(
      writeObservabilityBatch({ features: [{ ...valid, durationMs }] }),
    ).rejects.toThrow();
  expect(
    await db.featureOperationEvent.count({ where: { id: valid.id } }),
  ).toBe(0);
});

it("admin.feature-experience-outcomes", async () => {
  const id = requestId();
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const response = new Response(
    '{"type":"data","nodes":[{"type":"error","error":{"message":"private"}}]}',
    { headers: { "content-type": "application/json" } },
  );
  const result = await capture(() =>
    observeHttpFeature(
      new Request("http://localhost:3000/catalog/courses/123/__data.json"),
      id,
      () => response,
    ),
  );
  expect(result).toBe(response);
  expect(response.bodyUsed).toBe(false);
  expect(
    await db.featureOperationEvent.findMany({ where: { requestId: id } }),
  ).toEqual([
    expect.objectContaining({ outcome: "unknown", errorClass: "none" }),
  ]);
  expect(await db.runtimeIssueEvent.count({ where: { requestId: id } })).toBe(
    0,
  );
  expect(warn).not.toHaveBeenCalled();
});

it("admin.feature-experience-retention", async () => {
  const id = requestId();
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const businessResult = await capture(() => {
    for (let index = 0; index < 300; index++)
      recordFeatureOperation(
        { ...context, requestId: id },
        { outcome: "success", errorClass: "none" },
        1,
      );
    return "business-success";
  });
  expect(businessResult).toBe("business-success");
  expect(
    await db.featureOperationEvent.count({ where: { requestId: id } }),
  ).toBe(256);
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('"limit":256'));
  const failedId = requestId();
  expect(
    await capture(() => {
      collectFeatureEvent({
        ...context,
        id: crypto.randomUUID(),
        requestId: failedId,
        feature: "invalid-feature",
        outcome: "success",
        errorClass: "none",
        durationMs: 1,
      });
      return "still-success";
    }),
  ).toBe("still-success");
  expect(
    await db.featureOperationEvent.count({ where: { requestId: failedId } }),
  ).toBe(0);
  expect(warn).toHaveBeenCalledWith(
    expect.stringContaining("observability.write-failed"),
  );

  const now = new Date();
  const old = new Date(now.getTime() - 91 * 86400000);
  const retained = new Date(now.getTime() - 89 * 86400000);
  const retentionIds: string[] = [];
  for (const occurredAt of [old, old, retained]) {
    const featureId = crypto.randomUUID();
    const issueId = crypto.randomUUID();
    eventIds.push(featureId, issueId);
    retentionIds.push(featureId, issueId);
    await writeObservabilityBatch({
      features: [
        {
          ...context,
          id: featureId,
          occurredAt,
          outcome: "success",
          errorClass: "none",
          durationMs: 1,
        },
      ],
      issues: [
        { id: issueId, occurredAt, level: "warn", event: "page.request.error" },
      ],
    });
  }
  const maintenanceUrl = process.env.MAINTENANCE_DATABASE_URL;
  if (!maintenanceUrl)
    throw new Error("Expected production maintenance role URL");
  const maintenance = createTestPrisma(maintenanceUrl);
  try {
    for (let batch = 0; batch < 2; batch++) {
      const [report] = await maintenance.$queryRaw<
        Array<{ feature_rows_deleted: bigint; issue_rows_deleted: bigint }>
      >`SELECT * FROM public.maintain_observability_event_retention(${now}, ${1})`;
      expect(report).toEqual({
        feature_rows_deleted: 1n,
        issue_rows_deleted: 1n,
      });
    }
    expect(
      await db.featureOperationEvent.count({
        where: { id: { in: retentionIds } },
      }),
    ).toBe(1);
    expect(
      await db.runtimeIssueEvent.count({ where: { id: { in: retentionIds } } }),
    ).toBe(1);
  } finally {
    await maintenance.$disconnect();
  }
  const snapshot = await readPrometheusMetrics();
  const text = renderPrometheusMetrics({
    ...snapshot,
    firstFeatureRecordedAt: null,
    users: snapshot.users.map((row) => ({ ...row, activeUsers: null })),
    featureActivity: [],
  });
  expect(text).toContain("life_ustc_feature_observation_available 0");
  expect(text).not.toMatch(/^life_ustc_active_users\{/m);
});

it("admin.platform-runtime-logs", async () => {
  const id = requestId();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  await capture(() => {
    identifyObservedRequest(id);
    emitLog(
      "[app]",
      "error",
      {
        event: "api.request.error",
        status: 503,
        requestId: id,
        route: "/private-path",
        message: "private-message",
        body: "private-body",
        search: "private-search",
        ip: "private-ip",
        cookie: "private-cookie",
        token: "private-token",
      },
      new Error("private-stack"),
    );
    emitLog("[app]", "error", { event: "bad private event" });
    emitLog("[app]", "error", { event: "observability.write-failed" });
    emitLog("[app]", "error", { event: "analytics-engine.write-failed" });
  });
  const rows = await db.runtimeIssueEvent.findMany({
    where: { requestId: id },
  });
  expect(rows).toEqual([
    expect.objectContaining({
      event: "api.request.error",
      requestId: id,
      status: 503,
      route: null,
    }),
  ]);
  expect(JSON.stringify(rows)).not.toContain("private-");
  const failId = requestId();
  await capture(() => {
    identifyObservedRequest(failId);
    collectFeatureEvent({
      ...context,
      id: crypto.randomUUID(),
      feature: "invalid-feature",
      outcome: "error",
      errorClass: "internal",
      durationMs: 1,
    });
  });
  expect(
    await db.runtimeIssueEvent.count({ where: { requestId: failId } }),
  ).toBe(0);
});
