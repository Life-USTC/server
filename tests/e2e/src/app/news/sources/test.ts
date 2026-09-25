import { expect, test } from "@playwright/test";
import {
  createPublicationFixture,
  deletePublicationFixture,
  type PublicationFixture,
} from "../../../../utils/e2e-db";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { assertPageContract } from "../../_shared/page-contract";

test.describe.configure({ mode: "serial" });

let fixture: PublicationFixture;

test.beforeAll(async () => {
  fixture = await createPublicationFixture(
    `news-sources-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
  );
});

test.afterAll(async () => {
  await deletePublicationFixture(fixture);
});

test.describe("/news/sources 来源目录", () => {
  test("页面契约", async ({ page }, testInfo) => {
    await assertPageContract(page, { routePath: "/news/sources", testInfo });
  });

  test("按组织层级分组并显示各来源的内容数", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, "/news/sources", {
      testInfo,
      screenshotLabel: "news-sources-directory",
    });

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

  test("来源条目链接到该来源的列表筛选", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, "/news/sources", {
      testInfo,
      screenshotLabel: "news-sources-cross-link",
    });

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
    await page.getByRole("button", { name: /更多筛选|More filters/i }).click();
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

  test("REST 来源目录与页面显示一致", async ({ request }) => {
    // The directory advertises a 120s shared-cache TTL and the Worker honors
    // it, so a fixed URL would serve another run's snapshot. The unused query
    // param only changes the cache key; the route takes no query parameters.
    const response = await request.get(
      `/api/publications/sources?e2e=${Date.now()}`,
    );
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
