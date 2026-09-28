import { expect } from "vitest";
import { createDeferred } from "../shared/deferred";
import { metricsTest as it } from "../shared/metrics-fixture";
import type { TestPrismaClient } from "../shared/prisma";

async function expireCache(db: TestPrismaClient, seconds: number) {
  await db.$executeRaw`UPDATE public."PrometheusMetricsCache" SET "generatedAt" = (pg_catalog.statement_timestamp() AT TIME ZONE 'UTC') - ${seconds} * interval '1 second'`;
}

async function whileRefreshLocked(
  db: TestPrismaClient,
  action: () => Promise<void>,
) {
  const locked = createDeferred();
  const release = createDeferred();
  const holder = db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('life-ustc.prometheus-metrics-cache', 0))`;
    locked.resolve(undefined);
    await release.promise;
  });
  try {
    await Promise.race([locked.promise, holder]);
    await action();
  } finally {
    release.resolve(undefined);
    await holder;
  }
}

it("reuses a fresh exact activity snapshot", async ({ metrics: { read } }) => {
  const first = await read();
  const second = await read();
  expect(second.activityGeneratedAt).toBe(first.activityGeneratedAt);
  expect(second.summary).toEqual(first.summary);
});

it("refreshes activity after 60 seconds while preserving its values", async ({
  metrics: { db, read },
}) => {
  const first = await read();
  await expireCache(db, 61);
  const refreshed = await read();
  expect(Date.parse(refreshed.activityGeneratedAt)).toBeGreaterThan(
    Date.parse(first.activityGeneratedAt),
  );
  expect(refreshed.summary).toEqual(first.summary);
});

it("serves the bounded stale activity snapshot while another refresh owns the lock", async ({
  metrics: { db, read },
}) => {
  await read();
  await expireCache(db, 61);
  const [cached] = await db.$queryRaw<
    Array<{ generatedAt: Date }>
  >`SELECT "generatedAt" FROM public."PrometheusMetricsCache"`;
  await whileRefreshLocked(db, async () => {
    expect((await read()).activityGeneratedAt).toBe(
      cached.generatedAt.toISOString(),
    );
  });
  expect(Date.parse((await read()).activityGeneratedAt)).toBeGreaterThan(
    cached.generatedAt.getTime(),
  );
});

for (const state of ["empty", "expired"] as const) {
  it(`returns native scrape 503 for ${state} activity while refresh is locked and recovers after release`, async ({
    metrics: { db, read, serve },
  }) => {
    if (state === "expired") {
      await read();
      await expireCache(db, 121);
    }
    await whileRefreshLocked(db, async () => {
      await expect(read()).rejects.toThrow(
        "prometheus activity refresh is busy",
      );
      const response = await serve(
        new Request("http://localhost:3000/metrics", {
          headers: { authorization: "Bearer metrics-fixture-secret" },
        }),
      );
      expect(response.status).toBe(503);
      expect(await response.text()).toBe("Metrics unavailable\n");
      expect(response.headers.get("retry-after")).toBe("60");
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    });
    const recovered = await read();
    expect(recovered.summary).toEqual({
      users: 0,
      comments: 0,
      homeworks: 0,
      oauthClients: 0,
      activeSuspensions: 0,
    });
    expect(Number.isFinite(Date.parse(recovered.activityGeneratedAt))).toBe(
      true,
    );
    const response = await serve(
      new Request("http://localhost:3000/metrics", {
        headers: { authorization: "Bearer metrics-fixture-secret" },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain(
      "text/plain; version=0.0.4",
    );
    expect(await response.text()).toContain("# TYPE");
  });
}
