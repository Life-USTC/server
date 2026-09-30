import type { IsolatedWorker } from "../../../e2e/utils/isolated-worker";
import { test as ownedTest } from "../../../e2e/utils/owned-worker";
import type { TestPrismaClient } from "../../../shared/prisma";

// HTTP actors and independent state observations use this case's private
// Worker/database; callers own their entire setup and assertion body with run().
export const test = ownedTest.extend<{
  createActor: IsolatedWorker["createActor"];
  db: TestPrismaClient;
}>({
  createActor: async ({ isolatedWorker }, use) => {
    await use(isolatedWorker.createActor);
  },
  db: async ({ isolatedWorker }, use) => {
    await use(isolatedWorker.database.owner);
  },
});
