import { test as communityTest } from "./community-fixture";

type Section = { id: number; jwId: number; path: string };

export const test = communityTest.extend<{
  section: Section;
  memberSection: Section & { userId: string };
}>({
  section: async ({ community, page }, use) => {
    const path = `/catalog/sections/${community.section.jwId}`;
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
      if (errors.length)
        throw new AggregateError(
          errors,
          "Section subscription request cleanup failed",
        );
    };
    try {
      await page.route(
        (url) => url.pathname === path,
        async (route) => {
          if (route.request().method() !== "POST") return route.continue();
          const completion = (async () => {
            try {
              // Wait for the real Worker write before removing this test's catalog.
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
      await use({ ...community.section, path });
    } finally {
      await cleanup();
    }
  },
  memberSection: async ({ account, section }, use) => {
    // The account outlives the section's pending writes and catalog cleanup.
    await use({ ...section, userId: account.id });
  },
});
