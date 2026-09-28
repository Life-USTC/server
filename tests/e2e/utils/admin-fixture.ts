import type { User } from "../../../src/generated/prisma-node/client";
import { test as isolatedWorkerTest } from "./isolated-worker";

export const test = isolatedWorkerTest.extend<{
  admin: User & { username: string };
  account: User;
}>({
  admin: async ({ isolatedWorker, page }, use) => {
    const actor = await isolatedWorker.createActor({ isAdmin: true });
    await page.context().addCookies([actor.cookie]);
    const user = await isolatedWorker.database.owner.user.findUniqueOrThrow({
      where: { id: actor.id },
    });
    if (!user.username)
      throw new Error("The private actor must have a username");
    await use({ ...user, username: user.username });
  },
  account: async ({ isolatedWorker, page }, use) => {
    const actor = await isolatedWorker.createActor();
    await page.context().addCookies([actor.cookie]);
    await use(
      await isolatedWorker.database.owner.user.findUniqueOrThrow({
        where: { id: actor.id },
      }),
    );
  },
});
