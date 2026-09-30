import { test as workerTest } from "../../../e2e/utils/owned-worker";

export const test = workerTest.extend<{ _metricsCounters: undefined }>({
  _metricsCounters: [
    async ({ isolatedWorker, run }, use) => {
      await run(() =>
        isolatedWorker.database.owner.$transaction(async (db) => {
          // Schema-only clones omit migration data. The scrape's persistent
          // counters and refreshed snapshot belong to this private database.
          await db.$executeRaw`INSERT INTO public."PrometheusCounterEpoch" DEFAULT VALUES`;
          await db.$executeRaw`INSERT INTO public."PrometheusCounter" VALUES ('registrations', '{}', 0), ('deletions', '{}', 0)`;
        }),
      );
      await use(undefined);
    },
    { auto: true },
  ],
});
