import type { User } from "../../../src/generated/prisma-node/client";
import { withE2ePrisma } from "./e2e-db/prisma";
import { test as accountTest } from "./isolated-account";
import { absoluteTestUrl } from "./request-url";

type Profile = User & { username: string };

export const test = accountTest.extend<{
  incompleteProfile: Profile;
  avatars: { profile: Profile; options: [string, string] };
}>({
  incompleteProfile: async ({ account, page }, use) => {
    if (!account.username)
      throw new Error("Private onboarding account requires a username");
    const pending = new Set<Promise<void>>();
    const errors: unknown[] = [];
    let closing = false;
    const cleanup = async () => {
      closing = true;
      try {
        await page.close();
      } catch (error) {
        errors.push(error);
      }
      await Promise.all(pending);
      // The account fixture deletes only this user's rows after writes settle.
      if (errors.length)
        throw new AggregateError(errors, "Onboarding request cleanup failed");
    };
    try {
      // The intended completed profile is independent of the current form state.
      await withE2ePrisma((db) =>
        db.user.update({
          where: { id: account.id },
          data: { name: "", username: null },
        }),
      );
      await page.route(
        /\/account\/welcome\?\/complete(?:&|$)/,
        async (route) => {
          if (route.request().method() !== "POST") return route.continue();
          const completion = (async () => {
            try {
              const response = await route.fetch({ maxRedirects: 0 });
              try {
                await route.fulfill({ response });
              } catch (error) {
                if (
                  !(
                    closing &&
                    page.isClosed() &&
                    error instanceof Error &&
                    /^route\.fulfill: Target page, context or browser has been closed(?:\n|$)/.test(
                      error.message,
                    )
                  )
                )
                  throw error;
              }
            } catch (error) {
              errors.push(error);
            }
          })();
          pending.add(completion);
          try {
            await completion;
          } finally {
            pending.delete(completion);
          }
        },
      );
      await use({ ...account, username: account.username });
    } finally {
      await cleanup();
    }
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
