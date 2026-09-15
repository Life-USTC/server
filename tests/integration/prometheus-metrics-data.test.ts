import { afterAll, describe, expect, it } from "vitest";
import { readPrometheusMetrics } from "@/features/admin/server/prometheus-metrics-data";
import {
  type FeatureEventInput,
  writeObservabilityBatch,
} from "@/lib/db/feature-event-store";
import { prisma as runtime } from "@/lib/db/prisma";
import { createFixturePrisma } from "../shared/prisma";

const fixture = createFixturePrisma();
const ids: string[] = [];
const userIds: string[] = [];
const clientIds: string[] = [];
const day = 86400000;
function event(durationMs = 10): FeatureEventInput {
  const id = crypto.randomUUID();
  ids.push(id);
  return {
    id,
    feature: "catalog.search",
    operation: "search",
    protocol: "rest",
    surface: "unknown",
    authMode: "anonymous",
    outcome: "success",
    errorClass: "none",
    durationMs,
  };
}
const total = (snapshot: Awaited<ReturnType<typeof readPrometheusMetrics>>) =>
  snapshot.features.find(
    (row) =>
      row.feature === "catalog.search" &&
      row.operation === "search" &&
      row.protocol === "rest" &&
      row.surface === "unknown" &&
      row.authMode === "anonymous" &&
      row.outcome === "success",
  )?.events ?? 0;
const histogram = (
  snapshot: Awaited<ReturnType<typeof readPrometheusMetrics>>,
) =>
  snapshot.featureDurations.find(
    (row) =>
      row.feature === "catalog.search" &&
      row.operation === "search" &&
      row.protocol === "rest",
  );
afterAll(async () => {
  await fixture.featureOperationEvent.deleteMany({
    where: { id: { in: ids } },
  });
  await fixture.auditLog.deleteMany({ where: { id: { in: ids } } });
  await fixture.runtimeIssueEvent.deleteMany({ where: { id: { in: ids } } });
  await fixture.oAuthClient.deleteMany({
    where: { clientId: { in: clientIds } },
  });
  await fixture.user.deleteMany({ where: { id: { in: userIds } } });
  await fixture.$executeRaw`DELETE FROM public."PrometheusMetricsCache"`;
  await Promise.all([fixture.$disconnect(), runtime.$disconnect()]);
});
describe("Persistent Prometheus metrics", () => {
  it("counts concurrent committed inserts exactly once, deduplicates replay, and reads counters while activity is cached", async () => {
    const before = await readPrometheusMetrics();
    const events = Array.from({ length: 12 }, () => event());
    await Promise.all(
      events.map((row) => writeObservabilityBatch({ features: [row] })),
    );
    await writeObservabilityBatch({ features: events });
    const after = await readPrometheusMetrics();
    expect(total(after) - total(before)).toBe(12);
    expect(after.activityGeneratedAt).toBe(before.activityGeneratedAt);
    expect(Date.parse(after.generatedAt)).toBeGreaterThan(
      Date.parse(before.generatedAt),
    );
    const rolledBack = event();
    await expect(
      fixture.$transaction(async (tx) => {
        await tx.featureOperationEvent.create({ data: rolledBack });
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect(total(await readPrometheusMetrics())).toBe(total(after));
    await fixture.featureOperationEvent.deleteMany({
      where: { id: { in: events.map((row) => row.id) } },
    });
    expect(total(await readPrometheusMetrics())).toBe(total(after));
  });
  it("persists cumulative bucket boundaries, count and sum independently of raw retention", async () => {
    const before = histogram(await readPrometheusMetrics());
    const durations = [
      0, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 10001,
    ];
    const rows = durations.map((duration) => ({
      ...event(duration),
      occurredAt: new Date(Date.now() - 100 * day),
    }));
    await writeObservabilityBatch({ features: rows });
    const after = histogram(await readPrometheusMetrics());
    expect(after).toBeDefined();
    if (!after) throw new Error("Missing histogram");
    expect(after.count - (before?.count ?? 0)).toBe(durations.length);
    expect(after.durationSeconds - (before?.durationSeconds ?? 0)).toBeCloseTo(
      durations.reduce((a, b) => a + b, 0) / 1000,
      6,
    );
    expect(after.buckets.map((n, i) => n - (before?.buckets[i] ?? 0))).toEqual([
      2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
    await fixture.featureOperationEvent.deleteMany({
      where: { id: { in: rows.map((row) => row.id) } },
    });
    expect(histogram(await readPrometheusMetrics())).toEqual(after);
  });
  it("preserves sub-microsecond duration sums", async () => {
    const before =
      histogram(await readPrometheusMetrics())?.durationSeconds ?? 0;
    await writeObservabilityBatch({ features: [event(0.123456789)] });
    const after =
      histogram(await readPrometheusMetrics())?.durationSeconds ?? 0;
    expect(after - before).toBeCloseTo(0.000123456789, 12);
  });
  it("uses rolling exact unique-user windows while deletion preserves cumulative counts", async () => {
    await fixture.$executeRaw`DELETE FROM public."PrometheusMetricsCache"`;
    const initial = await readPrometheusMetrics();
    const users = await Promise.all(
      [0, 1, 2, 3].map(() =>
        fixture.user.create({
          data: {
            email: `native-${crypto.randomUUID()}@example.test`,
            name: "Native metrics fixture",
          },
        }),
      ),
    );
    userIds.push(...users.map((user) => user.id));
    const rows = [0.5, 2, 8, 31].map((age, index) => ({
      ...event(),
      feature: "catalog.teacher",
      operation: "get",
      userId: users[index].id,
      occurredAt: new Date(Date.now() - age * day),
    }));
    // A repeated visit by the same person must not increase distinct users.
    rows.push({
      ...event(),
      feature: "catalog.teacher",
      operation: "get",
      userId: users[0].id,
      occurredAt: new Date(Date.now() - 2 * day),
    });
    await writeObservabilityBatch({ features: rows });
    await fixture.$executeRaw`DELETE FROM public."PrometheusMetricsCache"`;
    const beforeDelete = await readPrometheusMetrics();
    expect(beforeDelete.registrations - initial.registrations).toBe(4);
    const activity = (snapshot: typeof initial, window: string) =>
      snapshot.featureActivity.find(
        (row) =>
          row.feature === "catalog.teacher" &&
          row.protocol === "rest" &&
          row.window === window,
      )?.users ?? 0;
    for (const [window, delta] of [
      ["24h", 1],
      ["7d", 2],
      ["30d", 3],
    ] as const)
      expect(activity(beforeDelete, window) - activity(initial, window)).toBe(
        delta,
      );
    await fixture.user.deleteMany({
      where: { id: { in: users.map((user) => user.id) } },
    });
    const after = await readPrometheusMetrics();
    expect(after.registrations).toBe(beforeDelete.registrations);
    expect(after.deletions - beforeDelete.deletions).toBe(4);
    expect(after.features).toEqual(beforeDelete.features);
  });
  it("counts OAuth upsert deltas and retains counts after usage/account removal", async () => {
    const before = await readPrometheusMetrics();
    const user = await fixture.user.create({
      data: {
        email: `oauth-native-${crypto.randomUUID()}@example.test`,
        name: "OAuth metrics fixture",
      },
    });
    userIds.push(user.id);
    const clientId = crypto.randomUUID();
    clientIds.push(clientId);
    await fixture.oAuthClient.create({
      data: {
        clientId,
        name: "metrics fixture",
        redirectUris: [],
        userId: user.id,
      },
    });
    const id = crypto.randomUUID();
    const write = () =>
      fixture.$executeRaw`INSERT INTO public."OAuthGrantUsageDaily" (id,"userId","clientId","grantKey",day,feature,channel,"readCount","writeCount","errorCount","lastUsedAt","updatedAt") VALUES (${id},${user.id},${clientId},'metrics',CURRENT_DATE,'catalog.course','mcp',1,2,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET "readCount"="OAuthGrantUsageDaily"."readCount"+1,"writeCount"="OAuthGrantUsageDaily"."writeCount"+2,"errorCount"="OAuthGrantUsageDaily"."errorCount"+1`;
    await write();
    await write();
    const selected = (snapshot: typeof before) =>
      snapshot.oauth.find(
        (row) => row.channel === "mcp" && row.feature === "catalog.course",
      );
    const after = await readPrometheusMetrics();
    for (const [key, delta] of [
      ["readCount", 2],
      ["writeCount", 4],
      ["errorCount", 2],
    ] as const)
      expect(
        (selected(after)?.[key] ?? 0) - (selected(before)?.[key] ?? 0),
      ).toBe(delta);
    await fixture.oAuthGrantUsageDaily.delete({ where: { id } });
    expect(selected(await readPrometheusMetrics())).toEqual(selected(after));
  });
  it("folds arbitrary runtime labels and retains totals after cleanup", async () => {
    const before = await readPrometheusMetrics();
    const id = crypto.randomUUID();
    ids.push(id);
    await writeObservabilityBatch({
      issues: [
        { id, level: "error", event: "arbitrary-private-name", status: 503 },
      ],
    });
    await writeObservabilityBatch({
      issues: [
        { id, level: "error", event: "arbitrary-private-name", status: 503 },
      ],
    });
    const selected = (snapshot: typeof before) =>
      snapshot.runtime.find(
        (row) =>
          row.level === "error" &&
          row.event === "other" &&
          row.status === "5xx",
      )?.events ?? 0;
    expect(selected(await readPrometheusMetrics()) - selected(before)).toBe(1);
    await fixture.runtimeIssueEvent.delete({ where: { id } });
    expect(selected(await readPrometheusMetrics()) - selected(before)).toBe(1);
  });
  it("counts audit inserts once and never decrements during audit retention", async () => {
    const before = await readPrometheusMetrics();
    const id = crypto.randomUUID();
    ids.push(id);
    const selected = (snapshot: typeof before) =>
      snapshot.audit.find(
        (row) =>
          row.action === "homework_create" &&
          row.channel === "web" &&
          row.outcome === "success",
      )?.events ?? 0;
    await fixture.auditLog.createMany({
      data: [
        { id, action: "homework_create", channel: "web", outcome: "success" },
      ],
      skipDuplicates: true,
    });
    await fixture.auditLog.createMany({
      data: [
        { id, action: "homework_create", channel: "web", outcome: "success" },
      ],
      skipDuplicates: true,
    });
    expect(selected(await readPrometheusMetrics()) - selected(before)).toBe(1);
    await fixture.auditLog.delete({ where: { id } });
    expect(selected(await readPrometheusMetrics()) - selected(before)).toBe(1);
  });
  it("denies direct aggregate table reads and writes to the application", async () => {
    await expect(
      runtime.$queryRaw`SELECT * FROM public."PrometheusCounter"`,
    ).rejects.toThrow();
    await expect(
      runtime.$executeRaw`UPDATE public."PrometheusCounter" SET value=0`,
    ).rejects.toThrow();
    await expect(
      runtime.$queryRaw`SELECT * FROM public."PrometheusCounterEpoch"`,
    ).rejects.toThrow();
  });
});
