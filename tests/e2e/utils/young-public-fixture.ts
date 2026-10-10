import type { Prisma } from "../../../src/generated/prisma-node/client";
import { DEV_SEED } from "./dev-seed";
import { test as preferenceTest } from "./personal-preferences-fixture";

/** Active/ended activities and one organizer are private input for public browsing. */
export async function arrangeYoungPublicState(db: Prisma.TransactionClient) {
  const organizer = await db.youngOrganizer.create({
    data: {
      id: "dev-scenario-young-organizer",
      name: DEV_SEED.youngEvent.organizer,
      normalizedName: DEV_SEED.youngEvent.organizer,
    },
  });
  await db.youngEvent.createMany({
    data: [
      {
        youngId: DEV_SEED.youngEvent.youngId,
        name: DEV_SEED.youngEvent.name,
        category: DEV_SEED.youngEvent.category,
        location: DEV_SEED.youngEvent.location,
        organizer: organizer.name,
        organizerId: organizer.id,
        isActive: true,
        module: "智",
        activityLevel: "校级",
        requiresSignup: true,
        startAt: new Date("2026-05-10T06:00:00Z"),
        endAt: new Date("2026-05-10T08:00:00Z"),
        applyStartAt: new Date("2026-04-28T16:00:00Z"),
        applyEndAt: new Date("2026-05-09T15:59:59Z"),
        rawJson: {},
      },
      {
        youngId: "dev-scenario-young-event-ended",
        name: "第二课堂已结束活动",
        category: DEV_SEED.youngEvent.category,
        isActive: false,
        rawJson: {},
      },
    ],
  });
}

export const test = preferenceTest.extend<{ youngPublicState: undefined }>({
  youngPublicState: async ({ isolatedWorker, preferenceFlow }, use) => {
    await preferenceFlow.prepare(() =>
      isolatedWorker.database.owner.$transaction(arrangeYoungPublicState),
    );
    await use(undefined);
  },
});
