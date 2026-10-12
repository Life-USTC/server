import { createServer } from "node:net";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { servePrometheusMetrics } from "@/features/admin/server/prometheus-metrics";
import { readPrometheusMetrics } from "@/features/admin/server/prometheus-metrics-data";
import { createBasePrisma } from "@/lib/db/prisma-query-events";
import { withRuntimeDatabaseSnapshot } from "@/lib/db/runtime-database-snapshot";
import { createDeferred } from "../shared/deferred";
import { createFixturePrisma } from "../shared/prisma";

const fixture = createFixturePrisma();
const applicationName = `snapshot-lifecycle-${crypto.randomUUID()}`;
const limits = { maxWaitMs: 2_000, timeoutMs: 15_000 };

async function cacheTimestamp() {
  const [row] = await fixture.$queryRaw<Array<{ generatedAt: Date }>>`
    SELECT "generatedAt" FROM public."PrometheusMetricsCache" WHERE id = 1
  `;
  return row.generatedAt.toISOString();
}

async function expectDisconnected(timeout = 1_000) {
  await expect
    .poll(
      async () => {
        const [row] = await fixture.$queryRaw<Array<{ count: bigint }>>`
        SELECT count(*) FROM pg_catalog.pg_stat_activity
        WHERE application_name = ${applicationName}
      `;
        return Number(row.count);
      },
      { timeout },
    )
    .toBe(0);
}

describe("bounded direct SQL snapshots", () => {
  beforeEach(async () => {
    const url = new URL(process.env.DATABASE_URL as string);
    url.searchParams.set("application_name", applicationName);
    vi.stubEnv("DATABASE_URL", url.href);
    await fixture.$executeRaw`DELETE FROM public."PrometheusMetricsCache"`;
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    await fixture.$executeRaw`DELETE FROM public."PrometheusMetricsCache"`;
  });
  afterAll(() => fixture.$disconnect());

  it("commits the snapshot refresh and uses repeatable-read isolation", {
    tags: ["@Infrastructure/Runtime"],
  }, async () => {
    const value = await withRuntimeDatabaseSnapshot(
      "app",
      limits,
      async (connection) => {
        const { rows } = await connection.query("SHOW transaction_isolation");
        expect(rows[0].transaction_isolation).toBe("repeatable read");
        await connection.query(
          "SELECT * FROM public.read_prometheus_metrics_snapshot()",
        );
        return "committed";
      },
    );
    expect(value).toBe("committed");
    expect(Date.parse(await cacheTimestamp())).toBeGreaterThan(0);
    await expectDisconnected();
  });

  it("rolls back writes on a SQL failure and releases the connection", {
    tags: ["@Infrastructure/Runtime"],
  }, async () => {
    await expect(
      withRuntimeDatabaseSnapshot("app", limits, async (connection) => {
        await connection.query(
          "SELECT * FROM public.read_prometheus_metrics_snapshot()",
        );
        await connection.query("SELECT 1 / 0");
      }),
    ).rejects.toThrow();
    const rows = await fixture.$queryRaw<
      Array<{ id: number }>
    >`SELECT id FROM public."PrometheusMetricsCache"`;
    expect(rows).toEqual([]);
    await expectDisconnected();
  });

  it("preserves PostgreSQL statement limits and final rollback after either transaction deadline", {
    tags: ["@Infrastructure/Runtime"],
  }, async () => {
    // The old Prisma deadline also queues ROLLBACK behind active PostgreSQL
    // statements; it does not cancel them. Check both implementations against
    // the same server-side bound, independently of their return timing.
    const baseline = createBasePrisma();
    const baselineStarted = performance.now();
    try {
      await expect(
        baseline.$transaction(
          async (tx) => {
            await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '600ms'");
            await tx.$queryRawUnsafe(
              "SELECT * FROM public.read_prometheus_metrics_snapshot()",
            );
            await tx.$executeRawUnsafe("SELECT pg_sleep(0.2)");
            await tx.$executeRawUnsafe("SELECT pg_sleep(5)");
          },
          { maxWait: 2_000, timeout: 300 },
        ),
      ).rejects.toThrow();
      expect(performance.now() - baselineStarted).toBeLessThan(2_000);
    } finally {
      await baseline.$disconnect();
    }
    await expectDisconnected();
    const baselineRows = await fixture.$queryRaw<
      Array<{ id: number }>
    >`SELECT id FROM public."PrometheusMetricsCache"`;
    expect(baselineRows).toEqual([]);
    const started = performance.now();
    await expect(
      withRuntimeDatabaseSnapshot(
        "app",
        { maxWaitMs: 2_000, timeoutMs: 300 },
        async (connection) => {
          await connection.query("SET LOCAL statement_timeout = '600ms'");
          await connection.query(
            "SELECT * FROM public.read_prometheus_metrics_snapshot()",
          );
          await connection.query("SELECT pg_sleep(0.2)");
          await connection.query("SELECT pg_sleep(5)");
        },
      ),
    ).rejects.toThrow();
    expect(performance.now() - started).toBeLessThan(2_000);
    const rows = await fixture.$queryRaw<
      Array<{ id: number }>
    >`SELECT id FROM public."PrometheusMetricsCache"`;
    expect(rows).toEqual([]);
    // The active 600 ms statement can outlive the 300 ms client deadline;
    // require server cleanup within that bound plus scheduling overhead.
    await expectDisconnected(2_000);
    expect((await readPrometheusMetrics()).generatedAt).toBeTruthy();
    await expectDisconnected();
  });

  it("bounds a stalled connection handshake and closes its socket", {
    tags: ["@Infrastructure/Runtime"],
  }, async () => {
    const sockets = new Set<import("node:net").Socket>();
    const server = createServer((socket) => {
      sockets.add(socket);
      socket.on("data", () => {});
      socket.on("close", () => sockets.delete(socket));
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No port");
    vi.stubEnv(
      "DATABASE_URL",
      `postgresql://unused:unused@127.0.0.1:${address.port}/unused`,
    );
    const action = vi.fn();
    const started = performance.now();
    try {
      await expect(
        withRuntimeDatabaseSnapshot(
          "app",
          { maxWaitMs: 200, timeoutMs: 15_000 },
          action,
        ),
      ).rejects.toThrow();
      expect(performance.now() - started).toBeLessThan(2_000);
      expect(action).not.toHaveBeenCalled();
      await expect.poll(() => sockets.size).toBe(0);
    } finally {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("rejects a malformed persisted metrics payload with 503 and releases its connection", {
    tags: ["@Infrastructure/Runtime"],
  }, async () => {
    await readPrometheusMetrics();
    await fixture.$executeRaw`
      UPDATE public."PrometheusMetricsCache"
      SET payload = jsonb_set(payload, '{summary,users}', '"not-a-count"'::jsonb)
      WHERE id = 1
    `;
    vi.stubEnv("METRICS_SECRET", "snapshot-lifecycle-secret");
    const response = await servePrometheusMetrics(
      new Request("http://localhost/metrics", {
        headers: { authorization: "Bearer snapshot-lifecycle-secret" },
      }),
    );
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("Metrics unavailable\n");
    await expectDisconnected();
  });

  it("keeps the metrics ten-second SQL limit while blocked on a database lock", {
    tags: ["@Infrastructure/Runtime"],
  }, async () => {
    const locked = createDeferred();
    const unlock = createDeferred();
    const holder = fixture.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(
          'LOCK TABLE public."PrometheusCounter" IN ACCESS EXCLUSIVE MODE',
        );
        locked.resolve(undefined);
        await unlock.promise;
      },
      { timeout: 20_000 },
    );
    vi.stubEnv("METRICS_SECRET", "snapshot-lifecycle-secret");
    try {
      await Promise.race([locked.promise, holder]);
      const started = performance.now();
      const response = await servePrometheusMetrics(
        new Request("http://localhost/metrics", {
          headers: { authorization: "Bearer snapshot-lifecycle-secret" },
        }),
      );
      expect(response.status).toBe(503);
      expect(await response.text()).toBe("Metrics unavailable\n");
      const elapsed = performance.now() - started;
      expect(elapsed).toBeGreaterThanOrEqual(9_000);
      expect(elapsed).toBeLessThan(15_000);
      await expectDisconnected();
      const rows = await fixture.$queryRaw<
        Array<{ id: number }>
      >`SELECT id FROM public."PrometheusMetricsCache"`;
      expect(rows).toEqual([]);
    } finally {
      unlock.resolve(undefined);
      await holder;
    }
  });
});
