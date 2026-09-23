import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { readPrometheusMetrics } from "@/features/admin/server/prometheus-metrics-data";
import { createDeferred } from "../shared/deferred";
import { createFixturePrisma } from "../shared/prisma";

const fixture = createFixturePrisma();

async function clearCache() {
  await fixture.$executeRaw`DELETE FROM public."PrometheusMetricsCache"`;
}

async function expireCache(seconds: number) {
  await fixture.$executeRaw`UPDATE public."PrometheusMetricsCache" SET "generatedAt" = (pg_catalog.statement_timestamp() AT TIME ZONE 'UTC') - ${seconds} * interval '1 second'`;
}

async function whileRefreshLocked(action: () => Promise<void>) {
  const locked = createDeferred();
  const release = createDeferred();
  const holder = fixture.$transaction(async (tx) => {
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

describe("Prometheus shared snapshot cache", () => {
  beforeEach(clearCache);
  afterEach(clearCache);
  afterAll(() => fixture.$disconnect());

  it("reuses a fresh snapshot and refreshes expired snapshots", async () => {
    const first = await readPrometheusMetrics();
    expect((await readPrometheusMetrics()).activityGeneratedAt).toEqual(
      first.activityGeneratedAt,
    );
    await expireCache(61);
    const refreshed = await readPrometheusMetrics();
    expect(Date.parse(refreshed.activityGeneratedAt)).toBeGreaterThan(
      Date.parse(first.activityGeneratedAt),
    );
    expect(refreshed.summary).toEqual(first.summary);
  });

  it("serves the bounded stale snapshot while another request refreshes", async () => {
    await readPrometheusMetrics();
    await expireCache(61);
    const [cached] = await fixture.$queryRaw<
      Array<{ generatedAt: Date }>
    >`SELECT "generatedAt" FROM public."PrometheusMetricsCache"`;
    await whileRefreshLocked(async () => {
      const snapshot = await readPrometheusMetrics();
      expect(snapshot.activityGeneratedAt).toBe(
        cached.generatedAt.toISOString(),
      );
    });
  });

  it.each(["empty", "expired"] as const)(
    "fails instead of blocking or serving an unusable %s snapshot",
    async (state) => {
      if (state === "expired") {
        await readPrometheusMetrics();
        await expireCache(121);
      }
      await whileRefreshLocked(async () => {
        await expect(readPrometheusMetrics()).rejects.toThrow();
      });
      // Releasing the lock permits a healthy collection after the failed scrape.
      expect((await readPrometheusMetrics()).generatedAt).toBeTruthy();
    },
  );
});
