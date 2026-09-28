import type { User } from "../../../src/generated/prisma-node/client";
import { withE2ePrisma } from "./e2e-db/prisma";
import { test as accountTest } from "./isolated-account";
import { absoluteTestUrl } from "./request-url";
import { withSettledPagePosts } from "./settled-page-posts";

type Profile = User & { username: string };

export const test = accountTest.extend<{
  incompleteProfile: Profile;
  avatars: { profile: Profile; options: [string, string] };
}>({
  incompleteProfile: async ({ account, page }, use) => {
    if (!account.username)
      throw new Error("Private onboarding account requires a username");
    const profile = { ...account, username: account.username };
    await withSettledPagePosts(
      page,
      /\/account\/welcome\?\/complete(?:&|$)/,
      async () => {
        // The intended completed profile is independent of the current form state.
        await withE2ePrisma((db) =>
          db.user.update({
            where: { id: account.id },
            data: { name: "", username: null },
          }),
        );
        await use(profile);
      },
    );
  },
  avatars: async ({ incompleteProfile, baseURL }, use) => {
    const options: [string, string] = [
      absoluteTestUrl("/images/icon.png?avatar=one", baseURL),
      absoluteTestUrl("/images/icon.png?avatar=two", baseURL),
    ];
    await withE2ePrisma((db) =>
      db.user.update({
        where: { id: incompleteProfile.id },
        data: { image: options[0], profilePictures: options },
      }),
    );
    await use({ profile: incompleteProfile, options });
  },
});
