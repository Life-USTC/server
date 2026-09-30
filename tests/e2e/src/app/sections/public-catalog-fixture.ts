import { expect } from "@playwright/test";
import {
  type CatalogContractFixture,
  createCatalogContractFixture,
} from "../../../../shared/catalog-contract-fixture";
import { test as workerTest } from "../../../utils/owned-worker";
import {
  type PreferenceFlow,
  withPreferenceFlow,
} from "../../../utils/preference-flow";

export type PublicCatalog = {
  fixture: CatalogContractFixture;
  user: { id: string };
};

export const test = workerTest.extend<{
  catalog: PublicCatalog;
  catalogFlow: PreferenceFlow;
}>({
  catalog: async ({ isolatedWorker, run }, use) => {
    await use(
      await run(() =>
        isolatedWorker.database.owner.$transaction(async (db) => {
          const fixture = await createCatalogContractFixture({
            $transaction: async (work) => work(db),
          });
          const user = await db.user.create({
            data: {
              email: `${fixture.marker}@example.test`,
              name: "Catalog contract viewer",
              username: fixture.marker,
            },
          });
          return { fixture, user };
        }),
      ),
    );
  },
  catalogFlow: async (
    { page, browser, request: observer, isolatedWorker, catalog, run },
    use,
    testInfo,
  ) => {
    await run(async () => {
      const errors: unknown[] = [];
      try {
        await withPreferenceFlow(
          { page, browser, observer, isolatedWorker, testInfo },
          use,
        );
      } catch (error) {
        errors.push(error);
      }
      // These checks run after the real body and tagged Worker work have joined,
      // including failures, while the private database is still owned by run.
      const db = isolatedWorker.database.owner;
      const observations = await Promise.allSettled([
        (async () => {
          const account = await db.user.findUniqueOrThrow({
            where: { id: catalog.user.id },
          });
          expect(account.calendarFeedToken).toBeNull();
        })(),
        (async () => {
          expect(await db.auditLog.findMany()).toEqual([]);
        })(),
      ]);
      errors.push(
        ...observations.flatMap((result) =>
          result.status === "rejected" ? [result.reason] : [],
        ),
      );
      if (errors.length === 1) throw errors[0];
      if (errors.length)
        throw new AggregateError(errors, "Public catalog workflow failed");
    });
  },
});
