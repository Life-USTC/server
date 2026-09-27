import { afterAll, afterEach, expect, it, vi } from "vitest";
import * as metricsData from "@/features/admin/server/prometheus-metrics-data";
import { renderPrometheusMetrics } from "@/features/admin/server/prometheus-metrics-render";
import { writeObservabilityBatch } from "@/lib/db/feature-event-store";
import { GET } from "@/routes/metrics/+server";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const marker = crypto.randomUUID();
const eventIds: string[] = [];
const userIds: string[] = [];
const clientIds: string[] = [];
const base = {
  feature: "catalog.teacher",
  operation: "get",
  protocol: "rest",
  surface: "unknown",
  authMode: "anonymous",
  outcome: "success",
  errorClass: "none",
  durationMs: 1,
};
function event() {
  const id = crypto.randomUUID();
  eventIds.push(id);
  return { ...base, id };
}
async function scrape(
  authorization?: string,
  cookie?: string,
  path = "/metrics",
) {
  const headers = new Headers();
  if (authorization) headers.set("authorization", authorization);
  if (cookie) headers.set("cookie", cookie);
  return GET({
    request: new Request(`http://localhost:3000${path}`, { headers }),
  } as Parameters<typeof GET>[0]);
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
afterAll(async () => {
  await db.featureOperationEvent.deleteMany({
    where: { id: { in: eventIds } },
  });
  await db.oAuthClient.deleteMany({ where: { clientId: { in: clientIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$executeRaw`DELETE FROM public."PrometheusMetricsCache"`;
  await db.$disconnect();
});

it("admin.prometheus-export", async () => {
  const read = vi.spyOn(metricsData, "readPrometheusMetrics");
  vi.stubEnv("METRICS_SECRET", "");
  expect((await scrape(`Bearer ${marker}`)).status).toBe(401);
  vi.stubEnv("METRICS_SECRET", marker);
  for (const authorization of [
    undefined,
    "Bearer wrong",
    `Basic ${marker}`,
    `Bearer ${marker} suffix`,
    `Bearer ${marker},other`,
    `Bearer ${"x".repeat(4097)}`,
  ]) {
    const response = await scrape(
      authorization,
      `better-auth.session_token=${marker}`,
      `/metrics?secret=${marker}`,
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(
      'Bearer realm="metrics"',
    );
  }
  expect(read).not.toHaveBeenCalled();
  await writeObservabilityBatch({ features: [event()] });
  const response = await scrape(
    `bEaReR ${marker}`,
    "better-auth.session_token=ignored",
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe(
    "text/plain; version=0.0.4; charset=utf-8",
  );
  expect(response.headers.get("cache-control")).toContain("no-store");
  const body = await response.text();
  expect(body).toContain("# TYPE life_ustc_users gauge\n");
  expect(body).toContain("# TYPE life_ustc_feature_operations_total counter\n");
  expect(body).toContain(
    "# TYPE life_ustc_feature_operation_duration_seconds histogram\n",
  );
  expect(body).not.toContain(marker);
  expect(body).not.toMatch(/(?:user_id|request_id|client_id|email|day)=/);
  expect(read).toHaveBeenCalledTimes(1);
});

it("admin.prometheus-collection", async () => {
  const before = await metricsData.readPrometheusMetrics();
  const [epoch] = await db.$queryRaw<
    Array<{ startedAt: Date }>
  >`SELECT "startedAt" FROM public."PrometheusCounterEpoch"`;
  expect(before.counterStartedAt).toBe(epoch.startedAt.toISOString());
  const count = (snapshot: typeof before) =>
    snapshot.features
      .filter(
        (row) =>
          row.feature === base.feature &&
          row.operation === base.operation &&
          row.protocol === base.protocol,
      )
      .reduce((sum, row) => sum + row.events, 0);
  // Seed retained history without its insertion trigger, as for pre-installation rows.
  const legacy = event();
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
    await tx.featureOperationEvent.create({
      data: {
        ...legacy,
        occurredAt: new Date(epoch.startedAt.getTime() - 1000),
      },
    });
  });
  expect(count(await metricsData.readPrometheusMetrics())).toBe(count(before));
  const rows = Array.from({ length: 12 }, () => event());
  await Promise.all(
    rows.map((row) => writeObservabilityBatch({ features: [row] })),
  );
  await writeObservabilityBatch({ features: rows });
  const after = await metricsData.readPrometheusMetrics();
  expect(count(after) - count(before)).toBe(12);
  expect(after.activityGeneratedAt).toBe(before.activityGeneratedAt);
  const rolledBack = event();
  await expect(
    db.$transaction(async (tx) => {
      await tx.featureOperationEvent.create({ data: rolledBack });
      throw new Error("rollback");
    }),
  ).rejects.toThrow("rollback");
  expect(count(await metricsData.readPrometheusMetrics())).toBe(count(after));
  await db.featureOperationEvent.deleteMany({
    where: { id: { in: rows.map((row) => row.id) } },
  });
  expect(count(await metricsData.readPrometheusMetrics())).toBe(count(after));
  const user = await db.user.create({
    data: { email: `metrics-${crypto.randomUUID()}@example.test` },
  });
  userIds.push(user.id);
  await writeObservabilityBatch({
    features: [{ ...event(), userId: user.id }],
  });
  const preDeletion = await metricsData.readPrometheusMetrics();
  await db.user.delete({ where: { id: user.id } });
  expect(count(await metricsData.readPrometheusMetrics())).toBe(
    count(preDeletion),
  );
  const histogram = (snapshot: typeof before) =>
    snapshot.featureDurations.find(
      (row) =>
        row.feature === base.feature &&
        row.operation === base.operation &&
        row.protocol === base.protocol,
    );
  const beforeHistogram = histogram(await metricsData.readPrometheusMetrics());
  const durations = [
    0, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 10001,
  ];
  await writeObservabilityBatch({
    features: durations.map((durationMs) => ({ ...event(), durationMs })),
  });
  const afterHistogram = histogram(await metricsData.readPrometheusMetrics());
  if (!afterHistogram) throw new Error("Expected histogram");
  expect(afterHistogram.count - (beforeHistogram?.count ?? 0)).toBe(
    durations.length,
  );
  expect(
    afterHistogram.durationSeconds - (beforeHistogram?.durationSeconds ?? 0),
  ).toBeCloseTo(durations.reduce((sum, value) => sum + value, 0) / 1000, 6);
  expect(
    afterHistogram.buckets.map(
      (value, index) => value - (beforeHistogram?.buckets[index] ?? 0),
    ),
  ).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
});

it("admin.prometheus-windows", async () => {
  await db.$executeRaw`DELETE FROM public."PrometheusMetricsCache"`;
  const before = await metricsData.readPrometheusMetrics();
  const users = await Promise.all(
    [0, 1, 2, 3].map(() =>
      db.user.create({
        data: { email: `window-${crypto.randomUUID()}@example.test` },
      }),
    ),
  );
  userIds.push(...users.map((user) => user.id));
  const ages = [0.5, 2, 8, 31];
  const rows = ages.map((age, index) => ({
    ...event(),
    authMode: "session",
    userId: users[index].id,
    occurredAt: new Date(Date.now() - age * 86400000),
  }));
  rows.push({
    ...rows[0],
    ...event(),
    authMode: "session",
    occurredAt: new Date(Date.now() - 2 * 86400000),
  });
  await writeObservabilityBatch({
    features: [
      ...rows,
      event(),
      { ...event(), protocol: "graphql", userId: users[3].id },
      {
        ...event(),
        userId: users[3].id,
        occurredAt: new Date(Date.now() + 86400000),
      },
    ],
  });
  for (const [index, age] of ages.entries()) {
    const clientId = `metrics-client-${crypto.randomUUID()}`;
    clientIds.push(clientId);
    await db.oAuthClient.create({ data: { clientId, name: marker } });
    for (const suffix of ["first", "repeat"])
      await db.oAuthGrantUsageDaily.create({
        data: {
          clientId,
          userId: users[index].id,
          grantKey: `${clientId}-${suffix}`,
          day: new Date(),
          feature: "account.profile",
          channel: "mcp",
          lastUsedAt: new Date(Date.now() - age * 86400000),
        },
      });
  }
  await db.$executeRaw`DELETE FROM public."PrometheusMetricsCache"`;
  const after = await metricsData.readPrometheusMetrics();
  const usersIn = (
    snapshot: typeof before,
    window: string,
    protocol = "rest",
  ) =>
    snapshot.featureActivity.find(
      (row) =>
        row.feature === base.feature &&
        row.protocol === protocol &&
        row.window === window,
    )?.users ?? 0;
  const clientsIn = (snapshot: typeof before, window: string) =>
    snapshot.oauthSummary.find((row) => row.window === window)?.activeClients ??
    0;
  for (const [window, delta] of [
    ["24h", 1],
    ["7d", 2],
    ["30d", 3],
  ] as const) {
    expect(usersIn(after, window) - usersIn(before, window)).toBe(delta);
    expect(
      usersIn(after, window, "graphql") - usersIn(before, window, "graphql"),
    ).toBe(1);
    expect(clientsIn(after, window) - clientsIn(before, window)).toBe(delta);
  }
  const text = renderPrometheusMetrics(after);
  const samples = text
    .split("\n")
    .filter((line) => line && !line.startsWith("#"));
  for (const line of samples) {
    if (line.includes("window="))
      expect(line).toMatch(
        /^life_ustc_(?:active_users|feature_active_users|oauth_active_clients)\{/,
      );
    if (line.startsWith("life_ustc_feature_operation_duration_seconds")) {
      // Earlier tests legitimately leave durable counters for other features.
      // The contract constrains label dimensions, not the database's feature set.
      const labels = line.match(/\{([^}]+)\}/)?.[1];
      expect(labels).toBeDefined();
      const keys = [...(labels ?? "").matchAll(/(?:^|,)([a-z_]+)="/g)].map(
        (match) => match[1],
      );
      expect(keys).toEqual(
        line.startsWith("life_ustc_feature_operation_duration_seconds_bucket{")
          ? ["feature", "le", "operation", "protocol"]
          : ["feature", "operation", "protocol"],
      );
    }
  }
});
