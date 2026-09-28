import {
  type IsolatedWorker,
  test as isolatedTest,
} from "../../../e2e/utils/isolated-worker";
import type { TestPrismaClient } from "../../../shared/prisma";

// HTTP actors and independent state observations use this case's private
// Worker/database; the native owner handles partial acquisition and teardown.
export const test = isolatedTest.extend<{
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
