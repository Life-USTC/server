import type { User } from "../../../src/generated/prisma-node/client";
import { arrangeBusTimetable } from "../../shared/bus-timetable";
import type { TestPrismaClient } from "../../shared/prisma";
import { DEV_SEED } from "./dev-seed";
import { test as workerTest } from "./isolated-worker";
import { withSettledPageWrites } from "./settled-page-writes";

export const test = workerTest.extend<{
  account: User;
  linkAccount: User;
  pinnedAccount: User;
  busAccount: User;
  busPreferences: User;
}>({
  account: async ({ isolatedWorker, page }, use) => {
    const actor = await isolatedWorker.createActor();
    await page.context().addCookies([actor.cookie]);
    await use(
      await isolatedWorker.database.owner.user.findUniqueOrThrow({
        where: { id: actor.id },
      }),
    );
  },
  linkAccount: async ({ account, page }, use) => {
    await withSettledPageWrites(
      page,
      (url) => url.pathname === "/api/workspace/link-pins",
      () => use(account),
    );
  },
  pinnedAccount: async ({ isolatedWorker, linkAccount }, use) => {
    await isolatedWorker.database.owner.workspaceLinkPin.createMany({
      data: DEV_SEED.catalogLinks.pinnedSlugs.map((slug) => ({
        userId: linkAccount.id,
        slug,
      })),
    });
    await use(linkAccount);
  },
  busAccount: async ({ account, page }, use) => {
    await withSettledPageWrites(
      page,
      (url) => url.pathname === "/api/workspace/bus-preferences",
      () => use(account),
    );
  },
  busPreferences: async ({ isolatedWorker, busAccount }, use) => {
    await isolatedWorker.database.owner.busUserPreference.create({
      data: {
        userId: busAccount.id,
        preferredOriginCampusId: null,
        preferredDestinationCampusId: null,
        showDepartedTrips: false,
      },
    });
    await use(busAccount);
  },
});

// These four routes are the planner's known input, independent of shared seed
// state. Links tests never request this fixture or acquire bus data.
export const busTest = test.extend<{ busTimetable: undefined }>({
  busTimetable: [
    async ({ isolatedWorker }, use) => {
      await arrangeBusTimetable(isolatedWorker.database.owner);
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
