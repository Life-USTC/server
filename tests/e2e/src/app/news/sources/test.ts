import { expect } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { test } from "../../../../utils/publication-fixture";
import { assertPageContract } from "../../_shared/page-contract";

test.describe("/news/sources 来源目录", () => {
  test("来源列筛选将数字比较与组织多选一次应用", {
    tag: "@Publication/Web",
  }, async ({ browseRun, page, publication: fixture }) => {
    await browseRun(async () => {
      for (const width of [390, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        await gotoAndWaitForReady(page, "/news/sources");
        const apply = page.getByRole("button", {
          name: /^(应用筛选|Apply filters)$/i,
        });
        await expect(apply).toHaveCount(1);
        const levelTrigger = page.getByRole("button", {
          name: /^(组织层级|Organization level)$/i,
        });
        await levelTrigger.focus();
        await page.keyboard.press("Enter");
        const levels = page.locator('[data-filter-field="organizationLevel"]');
        await levels
          .getByRole("checkbox", { name: /^(学校机关|University)$/i })
          .check();
        await levels
          .getByRole("checkbox", { name: /机关部处|Administrative offices/i })
          .check();
        await page.keyboard.press("Escape");
        await expect(levelTrigger).toBeFocused();
        const countTrigger = page
          .getByRole("button", { name: /^(内容数|Publications)$/i })
          .filter({ visible: true });
        await countTrigger.click();
        const dialog = page.getByRole("dialog", {
          name: /^(内容数|Publications)$/i,
        });
        await dialog.getByRole("combobox").selectOption("lte");
        await dialog.getByRole("spinbutton").fill("2");
        await expect(
          dialog.getByRole("button", { name: /应用筛选|Apply filters/i }),
        ).toHaveCount(0);
        await page.keyboard.press("Escape");
        await expect(page.locator("#level-university")).toBeVisible();
        await apply.click();
        await expect(page.locator("#level-university")).toHaveCount(0);
        await expect(page.locator("#level-office")).toContainText(
          fixture.officeSourceName,
        );
        await countTrigger.click();
        await dialog.getByRole("combobox").selectOption("gt");
        await dialog.getByRole("spinbutton").fill("30");
        await page.keyboard.press("Escape");
        await apply.click();
        await expect(page.locator("#level-office")).toHaveCount(0);
        await expect(countTrigger).toBeVisible();
        await countTrigger.click();
        await dialog.getByRole("spinbutton").fill("");
        await page.keyboard.press("Escape");
        await apply.click();
        await expect(page.locator("#level-office")).toBeVisible();
        await expect(page.locator("#level-university")).toBeVisible();
      }
    });
  });

  test("页面契约", { tag: "@Publication/Web" }, async ({ browseRun, page }) => {
    await browseRun(async () => {
      await assertPageContract(page, { routePath: "/news/sources" });
    });
  });

  test("按组织层级分组并显示各来源的内容数", {
    tag: "@Publication/Web",
  }, async ({ browseRun, page, publication: fixture }) => {
    await browseRun(async () => {
      await gotoAndWaitForReady(page, "/news/sources");

      await expect(
        page.getByRole("searchbox", {
          name: /搜索来源名称|Search source names/i,
        }),
      ).toBeVisible();

      const universityGroup = page.getByRole("heading", {
        level: 2,
        name: /^(学校机关|University)$/,
      });
      const officeGroup = page.getByRole("heading", {
        level: 2,
        name: /机关部处|Administrative offices/,
      });
      await expect(universityGroup).toBeVisible();
      await expect(officeGroup).toBeVisible();

      // The university group is declared first in the enum, so it must render
      // above the office group rather than in insertion or alphabetical order.
      const headingOrder = await page
        .getByRole("heading", { level: 2 })
        .allTextContents();
      const universityIndex = headingOrder.findIndex((text) =>
        /学校机关|University/.test(text),
      );
      const officeIndex = headingOrder.findIndex((text) =>
        /机关部处|Administrative offices/.test(text),
      );
      expect(universityIndex).toBeGreaterThanOrEqual(0);
      expect(universityIndex).toBeLessThan(officeIndex);

      const officeRow = page
        .getByRole("row")
        .filter({ hasText: fixture.officeSourceName });
      await expect(officeRow).toHaveCount(1);
      await expect(
        officeRow.getByRole("cell", {
          name: String(fixture.officeTotal),
          exact: true,
        }),
      ).toBeVisible();
      // Contentful sources must not show the empty-state never-published label.
      await expect(
        officeRow.getByText(/暂无发布|Nothing published yet/i),
      ).toHaveCount(0);

      const search = page.getByRole("searchbox", {
        name: /搜索来源名称|Search source names/i,
      });
      await search.fill(fixture.officeSourceName);
      await page
        .getByRole("button", { name: /^(应用筛选|Apply filters)$/i })
        .click();
      await expect(officeGroup).toBeVisible();
      await expect(universityGroup).toHaveCount(0);
      await expect(officeRow).toHaveCount(1);
      await search.fill("no-matching-source");
      await page
        .getByRole("button", { name: /^(应用筛选|Apply filters)$/i })
        .click();
      await expect(page.locator("tr[data-publication-source]")).toHaveCount(0);
      await expect(search).toBeVisible();
      await search.fill("");
      await page
        .getByRole("button", { name: /^(应用筛选|Apply filters)$/i })
        .click();
      await expect(universityGroup).toBeVisible();
      await expect(officeGroup).toBeVisible();
    });
  });

  test("全局表头搜索在手机与桌面保留分组锚点和空态恢复", {
    tag: "@Publication/Web",
  }, async ({ browseRun, page, publication: fixture }) => {
    await browseRun(async () => {
      for (const width of [390, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        await gotoAndWaitForReady(page, "/news/sources");
        const search = page.getByRole("searchbox", {
          name: /搜索来源名称|Search source names/i,
        });
        await expect(search).toHaveCount(1);
        expect(
          await search.evaluate((input) => Boolean(input.closest("thead"))),
        ).toBe(true);
        await page.locator('a[href="#level-office"]').click();
        await expect(page).toHaveURL(/#level-office$/);
        const group = page.locator("#level-office");
        await expect(group).toBeInViewport();
        const heading = group.getByRole("heading", { level: 2 });
        await expect(heading).toBeVisible();
        await search.fill(fixture.officeSourceName);
        await page
          .getByRole("button", { name: /^(应用筛选|Apply filters)$/i })
          .click();
        await expect(page.locator("#level-university")).toHaveCount(0);
        await expect(group).toContainText(fixture.officeSourceName);
        await search.fill("no-matching-source");
        await page
          .getByRole("button", { name: /^(应用筛选|Apply filters)$/i })
          .click();
        await expect(search).toBeVisible();
        await expect(page.locator("tr[data-publication-source]")).toHaveCount(
          0,
        );
        await search.fill("");
        await page
          .getByRole("button", { name: /^(应用筛选|Apply filters)$/i })
          .click();
        await expect(page.locator("#level-university")).toBeVisible();
        await expect(group).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
      }
    });
  });

  test("来源条目链接到该来源的列表筛选", { tag: "@Publication/Web" }, async ({
    browseRun,
    page,
    publication: fixture,
  }) => {
    await browseRun(async () => {
      await gotoAndWaitForReady(page, "/news/sources");

      const sourceLink = page.getByRole("link", {
        name: fixture.officeSourceName,
        exact: true,
      });
      await expect(sourceLink.first()).toHaveAttribute(
        "href",
        `/news?source=${encodeURIComponent(fixture.officeSourceId)}`,
      );
      await sourceLink.first().click();

      await expect(page).toHaveURL(
        new RegExp(
          `/news\\?source=${encodeURIComponent(fixture.officeSourceId)}$`,
        ),
      );
      await page
        .getByRole("button", { name: /更多筛选|More filters/i })
        .click();
      await expect(
        page.getByRole("checkbox", {
          name: fixture.officeSourceName,
          exact: true,
        }),
      ).toBeChecked();
      await expect(
        page.getByRole("link", { name: fixture.title, exact: true }),
      ).toHaveCount(0);
    });
  });

  test("REST 来源目录与页面显示一致", { tag: "@Publication/REST" }, async ({
    run,
    request,
    publication: fixture,
  }) => {
    await run(async () => {
      // The private Worker serves the real fixed URL and its 120-second cache.
      const response = await request.get("/api/publications/sources");
      expect(response.status()).toBe(200);
      expect(response.headers()["cache-control"]).toContain("s-maxage=120");

      const body = (await response.json()) as {
        groups: {
          organizationLevel: string;
          sourceCount: number;
          publicationCount: number;
          sources: {
            id: string;
            hosts: string[];
            publicationCount: number;
            lastPublishedAt: string | null;
          }[];
        }[];
        totals: { sourceCount: number; publicationCount: number };
      };

      const officeGroup = body.groups.find(
        (group) => group.organizationLevel === "office",
      );
      const listing = JSON.stringify(
        body.groups.map((group) => [
          group.organizationLevel,
          group.sources.map((source) => source.id),
        ]),
      );
      expect(officeGroup, listing).toBeDefined();
      const officeSource = officeGroup?.sources.find(
        (source) => source.id === fixture.officeSourceId,
      );
      expect(officeSource, listing).toBeDefined();
      expect(officeSource?.publicationCount).toBe(fixture.officeTotal);
      expect(officeSource?.hosts).toEqual(["office.example.test"]);
      expect(officeSource?.lastPublishedAt).toBeTruthy();
      expect(new Date(officeSource?.lastPublishedAt ?? "").toISOString()).toBe(
        "2026-08-30T16:00:00.000Z",
      );
      expect(body.totals).toEqual({ sourceCount: 2, publicationCount: 23 });

      // Group counts are derived, so they must add up to their members.
      for (const group of body.groups) {
        expect(group.sourceCount).toBe(group.sources.length);
        expect(group.publicationCount).toBe(
          group.sources.reduce(
            (total, source) => total + source.publicationCount,
            0,
          ),
        );
      }
      expect(body.totals.sourceCount).toBe(
        body.groups.reduce((total, group) => total + group.sourceCount, 0),
      );
    });
  });
});
