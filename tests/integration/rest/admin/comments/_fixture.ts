import type { IsolatedWorker } from "../../../../e2e/utils/isolated-worker";
import { test as workerTest } from "../../../../e2e/utils/owned-worker";
import { createCatalogContractFixture } from "../../../../shared/catalog-contract-fixture";

async function prepareComments(worker: IsolatedWorker) {
  const db = worker.database.owner;
  const owner = await worker.createActor();
  const admin = await worker.createActor({ isAdmin: true });
  const catalog = await createCatalogContractFixture(db);
  const section = catalog.sections[0];
  const [older, recent, softbanned, deleted] = await db.$transaction(
    (["active", "active", "softbanned", "deleted"] as const).map(
      (status, index) =>
        db.comment.create({
          data: {
            userId: owner.id,
            sectionId: section.id,
            body: `Known moderation comment ${index}`,
            status,
            isAnonymous: index === 1,
            createdAt: new Date(`2026-09-0${index + 1}T00:00:00Z`),
            updatedAt: new Date("2026-09-05T00:00:00Z"),
            deletedAt:
              status === "deleted" ? new Date("2026-09-05T00:00:00Z") : null,
          },
        }),
    ),
  );
  return { db, owner, admin, section, older, recent, softbanned, deleted };
}

// List pagination and identity-reveal audits use a private database. The run
// fixture joins complete preparation and test callbacks before disposal.
export const test = workerTest.extend<{
  commentState: Awaited<ReturnType<typeof prepareComments>>;
}>({
  commentState: async ({ isolatedWorker, run }, use) => {
    await use(await run(() => prepareComments(isolatedWorker)));
  },
});
export const base = "/api/admin/comments";
