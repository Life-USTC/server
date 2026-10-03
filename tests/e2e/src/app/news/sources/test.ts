import { expect } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { test } from "../../../../utils/publication-fixture";
import { assertPageContract } from "../../_shared/page-contract";

test.describe("/news/sources 来源目录", () => {
  test("页面契约", async ({ browseRun, page }) => {
    await browseRun(async () => {
      await assertPageContract(page, { routePath: "/news/sources" });
    });
  });

  test("按组织层级分组并显示各来源的内容数", async ({
    browseRun,
    page,
    publication: fixture,
  }) => {
    await browseRun(async () => {
      await gotoAndWaitForReady(page, "/news/sources");

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
    });
  });

  test("来源条目链接到该来源的列表筛选", async ({
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

  test("REST 来源目录与页面显示一致", async ({
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
