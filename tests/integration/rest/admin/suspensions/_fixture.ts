import {
  type IsolatedWorker,
  test as isolatedTest,
} from "../../../../e2e/utils/isolated-worker";

async function prepareSuspensions(worker: IsolatedWorker) {
  const db = worker.database.owner;
  const admin = await worker.createActor({ isAdmin: true });
  const ordinary = await worker.createActor();
  const target = await worker.createActor();
  const knownUser = await worker.createActor();
  const [historical, known] = await db.$transaction([
    db.userSuspension.create({
      data: {
        userId: knownUser.id,
        createdById: admin.id,
        reason: "Historical suspension",
        createdAt: new Date("2026-09-01T00:00:00Z"),
        liftedAt: new Date("2026-09-02T00:00:00Z"),
        liftedById: admin.id,
      },
    }),
    db.userSuspension.create({
      data: {
        userId: knownUser.id,
        createdById: admin.id,
        reason: "Known suspension record",
        createdAt: new Date("2026-09-03T00:00:00Z"),
      },
    }),
  ]);
  return { db, admin, ordinary, target, knownUser, historical, known };
}
export const test = isolatedTest.extend<{
  suspensionState: Awaited<ReturnType<typeof prepareSuspensions>>;
}>({
  suspensionState: async ({ isolatedWorker }, use) => {
    await use(await prepareSuspensions(isolatedWorker));
  },
});
export const base = "/api/admin/suspensions";
