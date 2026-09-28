import type { User } from "../../../src/generated/prisma-node/client";
import { DEV_SEED } from "./dev-seed";
import { setBusPreferenceFixture } from "./e2e-db/bus";
import { withE2ePrisma } from "./e2e-db/prisma";
import { test as accountTest } from "./isolated-account";
import { withSettledPageWrites } from "./settled-page-writes";

export const test = accountTest.extend<{
  linkAccount: User;
  pinnedAccount: User;
  busAccount: User;
  busPreferences: User;
}>({
  linkAccount: async ({ account, page }, use) => {
    await withSettledPageWrites(
      page,
      (url) => url.pathname === "/api/workspace/link-pins",
      () => use(account),
    );
  },
  pinnedAccount: async ({ linkAccount }, use) => {
    await withE2ePrisma((db) =>
      db.workspaceLinkPin.createMany({
        data: DEV_SEED.catalogLinks.pinnedSlugs.map((slug) => ({
          userId: linkAccount.id,
          slug,
        })),
      }),
    );
    await use(linkAccount);
  },
  busAccount: async ({ account, page }, use) => {
    await withSettledPageWrites(
      page,
      (url) => url.pathname === "/api/workspace/bus-preferences",
      () => use(account),
    );
  },
  busPreferences: async ({ busAccount }, use) => {
    await setBusPreferenceFixture(busAccount.id, {
      preferredOriginCampusId: null,
      preferredDestinationCampusId: null,
      showDepartedTrips: false,
    });
    await use(busAccount);
  },
});

export function storedPins(userId: string) {
  return withE2ePrisma(async (db) =>
    (
      await db.workspaceLinkPin.findMany({
        where: { userId },
        orderBy: { slug: "asc" },
        select: { slug: true },
      })
    ).map(({ slug }) => slug),
  );
}

export function storedBusPreference(userId: string) {
  return withE2ePrisma((db) =>
    db.busUserPreference.findUnique({
      where: { userId },
      select: {
        preferredOriginCampusId: true,
        preferredDestinationCampusId: true,
        showDepartedTrips: true,
      },
    }),
  );
}
