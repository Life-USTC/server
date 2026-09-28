import type { User } from "../../../src/generated/prisma-node/client";
import { test as workerTest } from "./isolated-worker";

/** A signed-in account exists only for cases requesting it. */
export const test = workerTest.extend<{ account: User }>({
  account: async ({ isolatedWorker, page }, use) => {
    const marker = crypto.randomUUID().replaceAll("-", "");
    const account = await isolatedWorker.database.owner.user.create({
      data: {
        name: `E2E account ${marker.slice(0, 8)}`,
        username: `e2e${marker.slice(0, 17)}`,
        email: `e2e-account-${marker}@example.test`,
        emailVerified: true,
      },
    });
    const session = await isolatedWorker.createSession(account.id);
    await page.context().addCookies([session.cookie]);
    await use(account);
  },
});
