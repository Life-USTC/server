import {
  type IsolatedWorker,
  test as isolatedTest,
} from "../../../../e2e/utils/isolated-worker";

async function prepareUsers(worker: IsolatedWorker) {
  const db = worker.database.owner;
  const admin = await worker.createActor({ isAdmin: true });
  const owner = await worker.createActor();
  const [adminUser, ownerUser] = await db.$transaction([
    db.user.update({
      where: { id: admin.id },
      data: {
        name: "Private administrator",
        username: "private-admin",
        createdAt: new Date("2026-09-01T00:00:00Z"),
      },
    }),
    db.user.update({
      where: { id: owner.id },
      data: {
        name: "Private reader",
        username: "private-user",
        createdAt: new Date("2026-09-02T00:00:00Z"),
      },
    }),
  ]);
  return { db, admin, owner, adminUser, ownerUser };
}
export const test = isolatedTest.extend<{
  userState: Awaited<ReturnType<typeof prepareUsers>>;
}>({
  userState: async ({ isolatedWorker }, use) => {
    await use(await prepareUsers(isolatedWorker));
  },
});
export const base = "/api/admin/users";
