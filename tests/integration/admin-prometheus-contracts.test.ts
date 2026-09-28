import { expect } from "vitest";
import { renderPrometheusMetrics } from "@/features/admin/server/prometheus-metrics-render";
import { metricsTest as it } from "../shared/metrics-fixture";

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
  return { ...base, id: crypto.randomUUID() };
}
function metricsRequest(
  authorization?: string,
  cookie?: string,
  path = "/metrics",
) {
  const headers = new Headers();
  if (authorization) headers.set("authorization", authorization);
  if (cookie) headers.set("cookie", cookie);
  return new Request(`http://localhost:3000${path}`, { headers });
}

it("rejects metric collection when the dedicated secret is absent", async ({
  metrics: { db, scrape },
}) => {
  const response = await scrape(
    metricsRequest("Bearer metrics-fixture-secret"),
    "",
  );
  expect(response.status).toBe(401);
  expect(await response.text()).toBe("Unauthorized\n");
  expect(
    await db.$queryRaw`SELECT id FROM public."PrometheusMetricsCache"`,
  ).toEqual([]);
});

for (const [label, authorization] of [
  ["missing bearer", undefined],
  ["wrong secret", "Bearer wrong"],
  ["basic scheme", "Basic metrics-fixture-secret"],
  ["extra whitespace token", "Bearer metrics-fixture-secret suffix"],
  ["comma joined tokens", "Bearer metrics-fixture-secret,other"],
  ["oversized token", `Bearer ${"x".repeat(4097)}`],
] as const) {
  it(`rejects ${label} despite a cookie and query secret`, async ({
    metrics: { db, scrape },
  }) => {
    const response = await scrape(
      metricsRequest(
        authorization,
        "better-auth.session_token=metrics-fixture-secret",
        "/metrics?secret=metrics-fixture-secret",
      ),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(
      'Bearer realm="metrics"',
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.text()).toBe("Unauthorized\n");
    // Collection would populate the activity cache; rejection must leave it empty.
    expect(
      await db.$queryRaw`SELECT id FROM public."PrometheusMetricsCache"`,
    ).toEqual([]);
  });
}

it("admin.prometheus-export", async ({ metrics: { db, scrape } }) => {
  await db.featureOperationEvent.create({ data: event() });
  const response = await scrape(
    metricsRequest(
      "bEaReR metrics-fixture-secret",
      "better-auth.session_token=ignored",
    ),
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
  expect(body).not.toContain("metrics-fixture-secret");
  expect(body).not.toMatch(/(?:user_id|request_id|client_id|email|day)=/);
  expect(
    await db.$queryRaw`SELECT id FROM public."PrometheusMetricsCache"`,
  ).toHaveLength(1);
});

it("ignores retained observations that predate the counter epoch", async ({
  metrics: { db, read },
}) => {
  const [epoch] = await db.$queryRaw<
    Array<{ startedAt: Date }>
  >`SELECT "startedAt" FROM public."PrometheusCounterEpoch"`;
  const legacy = event();
  // Arrange a retained observation without firing the new-counter insertion trigger.
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
    await tx.featureOperationEvent.create({
      data: {
        ...legacy,
        occurredAt: new Date(epoch.startedAt.getTime() - 1000),
      },
    });
  });
  const snapshot = await read();
  expect(snapshot.counterStartedAt).toBe(epoch.startedAt.toISOString());
  expect(snapshot.features).toEqual([]);
  expect(snapshot.featureDurations).toEqual([]);
  expect(
    await db.featureOperationEvent.findUnique({ where: { id: legacy.id } }),
  ).not.toBeNull();
});

it("rolls back observation rows and their counter triggers atomically", async ({
  metrics: { db, read },
}) => {
  const observation = event();
  await expect(
    db.$transaction(async (tx) => {
      await tx.featureOperationEvent.create({ data: observation });
      throw new Error("deliberate observation rollback");
    }),
  ).rejects.toThrow("deliberate observation rollback");
  expect(
    await db.featureOperationEvent.findUnique({
      where: { id: observation.id },
    }),
  ).toBeNull();
  const snapshot = await read();
  expect(snapshot.features).toEqual([]);
  expect(snapshot.featureDurations).toEqual([]);
});

it("admin.prometheus-windows", async ({ metrics: { db, read } }) => {
  const users = await Promise.all(
    [0, 1, 2, 3].map(() =>
      db.user.create({
        data: { email: `window-${crypto.randomUUID()}@example.test` },
      }),
    ),
  );
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
  await db.featureOperationEvent.createMany({
    data: [
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
    await db.oAuthClient.create({
      data: { clientId, name: "Independent metrics client" },
    });
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
  const after = await read();
  const usersIn = (snapshot: typeof after, window: string, protocol = "rest") =>
    snapshot.featureActivity.find(
      (row) =>
        row.feature === base.feature &&
        row.protocol === protocol &&
        row.window === window,
    )?.users ?? 0;
  const clientsIn = (snapshot: typeof after, window: string) =>
    snapshot.oauthSummary.find((row) => row.window === window)?.activeClients ??
    0;
  for (const [window, delta] of [
    ["24h", 1],
    ["7d", 2],
    ["30d", 3],
  ] as const) {
    expect(usersIn(after, window)).toBe(delta);
    expect(usersIn(after, window, "graphql")).toBe(1);
    expect(clientsIn(after, window)).toBe(delta);
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
