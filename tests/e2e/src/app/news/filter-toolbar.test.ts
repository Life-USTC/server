import { expect } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test } from "../../../utils/publication-fixture";

for (const locale of ["en-us", "zh-cn"] as const) {
  for (const width of [1280, 390]) {
    test(
      `news toolbar draft and empty clarity ${locale} ${width}`,
      { tag: "@Publication/Web" },
      async ({ page, isolatedWorker, publication, run, browseRun }, info) => {
        const sourceName =
          "Independent campus information and university announcements / 独立校园信息与学校公告";
        await run(() =>
          isolatedWorker.database.owner.publicationSource.update({
            where: { id: publication.sourceId },
            data: { name: sourceName },
          }),
        );
        await browseRun(async () => {
          await page.context().addCookies([
            {
              name: "NEXT_LOCALE",
              value: locale,
              url: isolatedWorker.origin,
            },
          ]);
          await page.setViewportSize({ width, height: 900 });
          await gotoAndWaitForReady(page, "/news");
          const search = page.getByRole("searchbox", {
            name: locale === "en-us" ? "Search" : "搜索",
            exact: true,
          });
          const types = page.getByRole("group", {
            name: locale === "en-us" ? "Type" : "类型",
            exact: true,
          });
          await expect(
            page.getByRole("link", { name: publication.title, exact: true }),
          ).toBeVisible();
          const searchHandle = await search.elementHandle();
          const searchBeforeType = await types.evaluate(
            (node, searchNode) =>
              Boolean(
                searchNode &&
                  searchNode.compareDocumentPosition(node) &
                    Node.DOCUMENT_POSITION_FOLLOWING,
              ),
            searchHandle,
          );
          await page.evaluate(() => document.fonts.ready);
          await info.attach(`news-unfiltered-${locale}-${width}`, {
            body: await page.screenshot(),
            contentType: "image/png",
          });
          await page
            .getByRole("button", {
              name: locale === "en-us" ? "More filters" : "更多筛选",
              exact: true,
            })
            .click();
          const dialog = page.getByRole("dialog", {
            name: locale === "en-us" ? "More filters" : "更多筛选",
            exact: true,
          });
          await expect(
            dialog.getByRole("checkbox", { name: sourceName, exact: true }),
          ).toBeVisible();
          await info.attach(`news-more-${locale}-${width}`, {
            body: await page.screenshot(),
            contentType: "image/png",
          });
          await page.keyboard.press("Escape");
          const query = "No matching campus bulletin 1437";
          await gotoAndWaitForReady(
            page,
            `/news?source=${encodeURIComponent(publication.sourceId)}&query=${encodeURIComponent(query)}`,
          );
          const chips = page.locator('[data-slot="active-filters"]');
          await expect(chips).toContainText(sourceName);
          await expect(chips).toContainText(query);
          await expect(
            page.getByRole("link", { name: publication.title, exact: true }),
          ).toHaveCount(0);
          await info.attach(`news-no-match-${locale}-${width}`, {
            body: await page.screenshot(),
            contentType: "image/png",
          });
          expect
            .soft(searchBeforeType, "Search is the first common filter")
            .toBe(true);
          await expect
            .soft(
              page.getByText(
                locale === "en-us"
                  ? "No matching publications"
                  : "没有符合筛选条件的新闻或通知",
                { exact: true },
              ),
            )
            .toBeVisible();
        });
      },
    );
  }
}
