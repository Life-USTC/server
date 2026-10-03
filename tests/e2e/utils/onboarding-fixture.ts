import type { Semester, User } from "../../../src/generated/prisma-node/client";
import type { TestPrismaClient } from "../../shared/prisma";
import { test as accountTest } from "./account-fixture";
import { absoluteTestUrl } from "./request-url";

type Profile = User & { username: string };

export const test = accountTest.extend<{
  incompleteProfile: Profile;
  avatars: { profile: Profile; options: [string, string] };
  semester: Semester;
}>({
  incompleteProfile: async ({ account, isolatedWorker, run }, use) => {
    if (!account.username)
      throw new Error("Private onboarding account requires a username");
    const profile = { ...account, username: account.username };
    // The intended completed profile is independent of the current form state.
    await run(() =>
      isolatedWorker.database.owner.user.update({
        where: { id: account.id },
        data: { name: "", username: null },
      }),
    );
    await use(profile);
  },
  avatars: async ({ incompleteProfile, baseURL, isolatedWorker, run }, use) => {
    const options: [string, string] = [
      absoluteTestUrl("/images/icon.png?avatar=one", baseURL),
      absoluteTestUrl("/images/icon.png?avatar=two", baseURL),
    ];
    await run(() =>
      isolatedWorker.database.owner.user.update({
        where: { id: incompleteProfile.id },
        data: { image: options[0], profilePictures: options },
      }),
    );
    await use({ profile: incompleteProfile, options });
  },
  semester: async ({ isolatedWorker, run }, use) => {
    await use(
      await run(() =>
        isolatedWorker.database.owner.semester.create({
          data: { jwId: 1, code: "421", nameCn: "2026年春季学期" },
        }),
      ),
    );
  },
});

export function getUserProfileById(db: TestPrismaClient, userId: string) {
  return db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, username: true, image: true, profilePictures: true },
  });
}
