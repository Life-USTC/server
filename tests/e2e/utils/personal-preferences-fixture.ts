import type { User } from "../../../src/generated/prisma-node/client";
import { arrangeBusTimetable } from "../../shared/bus-timetable";
import type { TestPrismaClient } from "../../shared/prisma";
import { DEV_SEED } from "./dev-seed";
import { test as workerTest } from "./owned-worker";
import { type PreferenceFlow, withPreferenceFlow } from "./preference-flow";

export const test = workerTest.extend<{
  preferenceFlow: PreferenceFlow;
  account: User;
  pinnedAccount: User;
  busPreferences: User;
}>({
  preferenceFlow: async ({ page, browser, request, isolatedWorker, run }, use, testInfo) => {
    await run(() => withPreferenceFlow({ page, browser, observer: request, isolatedWorker, testInfo }, use));
  },
  account: async ({ isolatedWorker, page, run, preferenceFlow: _flow }, use) => {
    const account = await run(async () => {
      const actor = await isolatedWorker.createActor();
      await page.context().addCookies([actor.cookie]);
      return isolatedWorker.database.owner.user.findUniqueOrThrow({ where: { id: actor.id } });
    });
    await use(account);
  },
  pinnedAccount: async ({ isolatedWorker, account, run }, use) => {
    await run(() => isolatedWorker.database.owner.workspaceLinkPin.createMany({
      data: DEV_SEED.catalogLinks.pinnedSlugs.map((slug) => ({
        userId: account.id,
        slug,
      })),
    }));
    await use(account);
  },
  busPreferences: async ({ isolatedWorker, account, run }, use) => {
    await run(() => isolatedWorker.database.owner.busUserPreference.create({
      data: {
        userId: account.id,
        preferredOriginCampusId: null,
        preferredDestinationCampusId: null,
        showDepartedTrips: false,
      },
    }));
    await use(account);
  },
});

// These four routes are the planner's known input, independent of shared seed
// state. Links tests never request this fixture or acquire bus data.
export const busTest = test.extend<{ busTimetable: undefined }>({
  busTimetable: [
    async ({ isolatedWorker, run }, use) => {
      await run(() => arrangeBusTimetable(isolatedWorker.database.owner));
      await use(undefined);
    },
    { auto: true },
  ],
});

export async function storedPins(db: TestPrismaClient, userId: string) {
  return (
    await db.workspaceLinkPin.findMany({
      where: { userId },
      orderBy: { slug: "asc" },
      select: { slug: true },
    })
  ).map(({ slug }) => slug);
}

export function storedBusPreference(db: TestPrismaClient, userId: string) {
  return db.busUserPreference.findUnique({
    where: { userId },
    select: {
      preferredOriginCampusId: true,
      preferredDestinationCampusId: true,
      showDepartedTrips: true,
    },
  });
}
