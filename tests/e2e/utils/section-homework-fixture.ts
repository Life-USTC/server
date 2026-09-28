import type { Section } from "../../../src/generated/prisma-node/client";
import { test as homeworkTest } from "./homework-fixture";
import { withSettledPageWrites } from "./settled-page-writes";

export const test = homeworkTest.extend<{
  section: Section & { path: string };
}>({
  section: async ({ academic, page }, use) => {
    await withSettledPageWrites(
      page,
      (url) =>
        url.pathname === "/api/community/section-homeworks" ||
        url.pathname.startsWith("/api/community/section-homeworks/") ||
        /^\/api\/workspace\/homeworks\/[^/]+\/completion$/.test(url.pathname),
      () =>
        use({
          ...academic.section,
          path: `/catalog/sections/${academic.section.jwId}`,
        }),
    );
  },
});
