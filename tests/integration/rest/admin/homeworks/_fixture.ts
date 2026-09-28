import {
  type IsolatedWorker,
  test as isolatedTest,
} from "../../../../e2e/utils/isolated-worker";
import { createCatalogContractFixture } from "../../../../shared/catalog-contract-fixture";

async function prepareHomeworks(worker: IsolatedWorker) {
  const db = worker.database.owner;
  const owner = await worker.createActor();
  const admin = await worker.createActor({ isAdmin: true });
  const catalog = await createCatalogContractFixture(db);
  const section = catalog.sections[0];
  const homeworks = await db.$transaction(
    ["Older homework", "Recent homework", "Deleted homework"].map(
      (title, index) =>
        db.homework.create({
          data: {
            title,
            sectionId: section.id,
            createdById: owner.id,
            createdAt: new Date(`2026-09-0${index + 1}T00:00:00Z`),
            updatedAt: new Date("2026-09-04T00:00:00Z"),
            publishedAt: new Date("2026-09-01T00:00:00Z"),
            submissionDueAt: new Date("2100-01-01T00:00:00Z"),
            deletedAt: index === 2 ? new Date("2026-09-04T00:00:00Z") : null,
            deletedById: index === 2 ? admin.id : null,
          },
        }),
    ),
  );
  return { db, owner, admin, catalog, section, homeworks };
}

// Admin lists observe every homework, so each case needs a private database.
// Worker teardown covers partial setup, failed assertions and soft deletes.
export const test = isolatedTest.extend<{
  homeworkState: Awaited<ReturnType<typeof prepareHomeworks>>;
}>({
  homeworkState: async ({ isolatedWorker }, use) => {
    await use(await prepareHomeworks(isolatedWorker));
  },
});
export const base = "/api/admin/homeworks";
