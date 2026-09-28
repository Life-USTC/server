import type { Semester, User } from "../../../src/generated/prisma-node/client";
import type { TestPrismaClient } from "../../shared/prisma";
import { test as workerTest } from "./isolated-worker";
import { absoluteTestUrl } from "./request-url";
import { withSettledPageWrites } from "./settled-page-writes";

type Profile = User & { username: string };

export const test = workerTest.extend<{
  account: User;
  incompleteProfile: Profile;
  avatars: { profile: Profile; options: [string, string] };
  semester: Semester;
}>({
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
  incompleteProfile: async ({ account, page, isolatedWorker }, use) => {
    if (!account.username)
      throw new Error("Private onboarding account requires a username");
    const profile = { ...account, username: account.username };
    await withSettledPageWrites(
      page,
      /\/account\/welcome\?\/complete(?:&|$)/,
      async () => {
        // The intended completed profile is independent of the current form state.
        await isolatedWorker.database.owner.user.update({
          where: { id: account.id },
          data: { name: "", username: null },
        });
        await use(profile);
      },
    );
  },
  avatars: async ({ incompleteProfile, baseURL, isolatedWorker }, use) => {
    const options: [string, string] = [
      absoluteTestUrl("/images/icon.png?avatar=one", baseURL),
      absoluteTestUrl("/images/icon.png?avatar=two", baseURL),
    ];
    await isolatedWorker.database.owner.user.update({
      where: { id: incompleteProfile.id },
      data: { image: options[0], profilePictures: options },
    });
    await use({ profile: incompleteProfile, options });
  },
  semester: async ({ isolatedWorker }, use) => {
    await use(
      await isolatedWorker.database.owner.semester.create({
        data: { jwId: 1, code: "421", nameCn: "2026年春季学期" },
      }),
    );
  },
});

export function getUserProfileById(db: TestPrismaClient, userId: string) {
  return db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, username: true, image: true, profilePictures: true },
  });
}
