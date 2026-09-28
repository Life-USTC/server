import { test as communityTest } from "./community-fixture";
import { withSettledPagePosts } from "./settled-page-posts";

type Section = { id: number; jwId: number; path: string };

export const test = communityTest.extend<{
  section: Section;
  memberSection: Section & { userId: string };
}>({
  section: async ({ community, page }, use) => {
    const path = `/catalog/sections/${community.section.jwId}`;
    await withSettledPagePosts(
      page,
      (url) => url.pathname === path,
      async () => {
        await use({ ...community.section, path });
      },
    );
  },
  memberSection: async ({ account, section }, use) => {
    // The account outlives the section's pending writes and catalog cleanup.
    await use({ ...section, userId: account.id });
  },
});
