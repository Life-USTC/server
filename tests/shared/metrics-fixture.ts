import { servePrometheusMetrics } from "@/features/admin/server/prometheus-metrics";
import { readPrometheusMetrics } from "@/features/admin/server/prometheus-metrics-data";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import { writeObservabilityBatch } from "@/lib/db/feature-event-store";
import { GET } from "@/routes/metrics/+server";
import { isolatedDatabaseTest } from "./isolated-database";
import type { TestPrismaClient } from "./prisma";

type MetricsFixture = {
  db: TestPrismaClient;
  app: TestPrismaClient;
  read: typeof readPrometheusMetrics;
  write: typeof writeObservabilityBatch;
  serve: typeof servePrometheusMetrics;
  scrape: (request: Request, secret?: string) => Promise<Response>;
};

export const metricsTest = isolatedDatabaseTest.extend<{
  metrics: MetricsFixture;
}>({
  metrics: async ({ isolatedDatabase: { owner, app, connections } }, use) => {
    // Initial singleton/counter data from the native-counter migration. Schema
    // snapshots contain no rows; these belong only to this test's database.
    await owner.$executeRaw`INSERT INTO public."PrometheusCounterEpoch" DEFAULT VALUES`;
    await owner.$executeRaw`INSERT INTO public."PrometheusCounter" VALUES ('registrations', '{}', 0), ('deletions', '{}', 0)`;
    const env = {
      HYPERDRIVE: { connectionString: connections.app },
      HYPERDRIVE_AUTH: { connectionString: connections.auth },
      HYPERDRIVE_MAINTENANCE: { connectionString: connections.maintenance },
      METRICS_SECRET: "metrics-fixture-secret",
    };
    const responses: Response[] = [];
    async function ownResponse(operation: Promise<Response>) {
      const response = await operation;
      responses.push(response);
      return response;
    }
    try {
      await use({
        db: owner,
        app,
        read: () => runWithCloudflareRuntimeEnv(env, readPrometheusMetrics),
        write: (batch) =>
          runWithCloudflareRuntimeEnv(env, () =>
            writeObservabilityBatch(batch),
          ),
        serve: (request) =>
          ownResponse(
            runWithCloudflareRuntimeEnv(env, () =>
              servePrometheusMetrics(request),
            ),
          ),
        scrape: (request, secret = env.METRICS_SECRET) =>
          ownResponse(
            runWithCloudflareRuntimeEnv(
              { ...env, METRICS_SECRET: secret },
              async () => GET({ request } as Parameters<typeof GET>[0]),
            ),
          ),
      });
    } finally {
      // Runtime Prisma cleanup follows response consumption. An assertion may
      // fail before text() is reached, so release those bodies before DB drop.
      await Promise.all(
        responses.map((response) =>
          response.body && !response.bodyUsed
            ? response.body.cancel()
            : undefined,
        ),
      );
    }
  },
});
