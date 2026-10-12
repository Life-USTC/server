import type { User } from "../../../../../../src/generated/prisma-node/client";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { test as preferenceTest } from "../../../../utils/personal-preferences-fixture";

/** Public profile subjects belong to this test; the browser remains anonymous. */
export const test = preferenceTest.extend<{
  publicAdminProfile: User;
  publicDebugProfile: User;
}>({
  publicAdminProfile: async ({ isolatedWorker, run }, use) => {
    const profile = await run(() =>
      isolatedWorker.database.owner.user.create({
        data: {
          name: DEV_SEED.adminName,
          username: DEV_SEED.adminUsername,
          email: "public-admin-profile@example.test",
          emailVerified: true,
          isAdmin: true,
          image: new URL("/images/icon.png", isolatedWorker.origin).href,
          createdAt: new Date("2026-04-01T00:00:00Z"),
        },
      }),
    );
    await use(profile);
  },
  publicDebugProfile: async ({ isolatedWorker, run }, use) => {
    const profile = await run(() =>
      isolatedWorker.database.owner.user.create({
        data: {
          name: DEV_SEED.debugName,
          username: DEV_SEED.debugUsername,
          email: "public-debug-profile@example.test",
          emailVerified: true,
          isAdmin: false,
          image: new URL("/images/icon.png", isolatedWorker.origin).href,
          createdAt: new Date("2026-04-01T00:00:00Z"),
        },
      }),
    );
    await use(profile);
  },
});
