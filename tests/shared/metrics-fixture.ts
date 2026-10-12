import { servePrometheusMetrics } from "@/features/admin/server/prometheus-metrics";
import { readPrometheusMetrics } from "@/features/admin/server/prometheus-metrics-data";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import { writeObservabilityBatch } from "@/lib/db/feature-event-store";
import { GET } from "@/routes/metrics/+server";
import { nodeProtocolTest } from "./node-protocol-fixture";
import type { NodeProtocolRuntime } from "./node-protocol-runtime";
import type { TestPrismaClient } from "./prisma";

type MetricsFixture = {
  db: TestPrismaClient;
  app: TestPrismaClient;
  run: NodeProtocolRuntime["run"];
  read: typeof readPrometheusMetrics;
  write: typeof writeObservabilityBatch;
  serve: typeof servePrometheusMetrics;
  scrape: (request: Request, secret?: string) => Promise<Response>;
};

export const metricsTest = nodeProtocolTest
  .extend({ protocolBindings: { METRICS_SECRET: "metrics-fixture-secret" } })
  .extend<{ metrics: MetricsFixture }>({
    metrics: async (
      { isolatedDatabase: { owner, app, connections }, protocolRuntime },
      use,
    ) => {
      await protocolRuntime.run(async () => {
        // Schema snapshots contain no rows; counters belong only to this test.
        await owner.$executeRaw`INSERT INTO public."PrometheusCounterEpoch" DEFAULT VALUES`;
        await owner.$executeRaw`INSERT INTO public."PrometheusCounter" VALUES ('registrations', '{}', 0), ('deletions', '{}', 0)`;
      });
      await use({
        db: owner,
        app,
        run: protocolRuntime.run,
        read: () => protocolRuntime.request(readPrometheusMetrics),
        write: (batch) =>
          protocolRuntime.request(() => writeObservabilityBatch(batch)),
        serve: (request) =>
          protocolRuntime.request(() => servePrometheusMetrics(request)),
        scrape: (request, secret = "metrics-fixture-secret") =>
          protocolRuntime.request(() =>
            runWithCloudflareRuntimeEnv(
              {
                HYPERDRIVE: { connectionString: connections.app },
                HYPERDRIVE_AUTH: { connectionString: connections.auth },
                HYPERDRIVE_MAINTENANCE: {
                  connectionString: connections.maintenance,
                },
                METRICS_SECRET: secret,
              },
              async () => GET({ request } as Parameters<typeof GET>[0]),
            ),
          ),
      });
    },
  });
