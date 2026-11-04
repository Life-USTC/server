import { expect } from "@playwright/test";
import { createSignedDemoCookie } from "../../../../shared/demo-token";
import { withBrowserWorkflow } from "../../../utils/browser-workflow";
import {
  applyCatalogFilters,
  openCatalogColumnFilter,
  setCatalogFilterValue,
} from "../../../utils/catalog-table-filters";
import { test } from "../../../utils/owned-worker";
import {
  expectNoPageHorizontalOverflow,
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../utils/page-ready";
import { expectRenderedUiQuality } from "../../../utils/ui-quality";

test.use({ workerBindings: { DEMO_ENABLED: "1", E2E_DEBUG_AUTH: "0" } });
for (const locale of ["zh-cn", "en-us"] as const) {
  for (const width of [1280, 390]) {
    test(
      `demo.sections: read-only browsing ${locale} ${width}`,
      { tag: "@Account/Web" },
      async ({ page, isolatedWorker, run }, testInfo) => {
        await withBrowserWorkflow(page, async (workflow) =>
          workflow.run(() =>
            run(() =>
              workflow.body(async () => {
                await page.setViewportSize({ width, height: 844 });
                await page.context().addCookies([
                  {
                    ...(await createSignedDemoCookie({
                      issuedAt: Math.floor(Date.now() / 1000),
                    })),
                    url: isolatedWorker.origin,
                  },
                  {
                    name: "NEXT_LOCALE",
                    value: locale,
                    url: isolatedWorker.origin,
                  },
                ]);
                await gotoAndWaitForReady(page, "/workspace/subscriptions");
                if (width === 1280) {
                  await page
                    .locator('a[href="/catalog/sections"]:visible')
                    .click();
                  await waitForUiSettled(page);
                } else await gotoAndWaitForReady(page, "/catalog/sections");
                await expect(
                  page.getByRole("heading", { level: 1 }),
                ).toHaveText(
                  locale === "en-us" ? "All Sections" : "所有教学班",
                );
                await expect(page.getByTestId("demo-notice")).toContainText(
                  locale === "en-us" ? "Read only" : "只读",
                );
                const rows = page.locator(
                  '#main-content a[href^="/catalog/sections/"]:visible',
                );
                await expect(rows).toHaveCount(3);
                expect(
                  await rows.evaluateAll((links) =>
                    links.map((link) => link.getAttribute("href")),
                  ),
                ).toEqual([
                  "/catalog/sections/910001",
                  "/catalog/sections/910002",
                  "/catalog/sections/910003",
                ]);
                await expect(rows.first()).toContainText(
                  locale === "en-us" ? "Linear Algebra" : "线性代数",
                );
                await expect(
                  page.locator('script[src*="googletagmanager.com"]'),
                ).toHaveCount(0);
                await expect(
                  page.locator('a[href$=".ics"]:visible'),
                ).toHaveCount(0);
                await expect(
                  page.locator('[data-slot="endless-scroll"]'),
                ).toHaveCount(0);
                const displayedRows =
                  width === 1280
                    ? page.locator("#main-content tbody tr:visible").filter({
                        has: page.locator('a[href^="/catalog/sections/"]'),
                      })
                    : rows;
                await expect(displayedRows).toHaveCount(3);
                for (const row of await displayedRows.all())
                  await expect(row).toContainText(/-\s*\/\s*-/);
                await expectRenderedUiQuality(page);
                await expectNoPageHorizontalOverflow(page);
                await page.screenshot({
                  path: testInfo.outputPath(`after-${locale}-${width}.png`),
                  fullPage: true,
                });

                // Unknown sample enrollment must not match a real zero count.
                await gotoAndWaitForReady(page, "/catalog/sections?stdCount=0");
                await expect(rows).toHaveCount(0);
                await expect(
                  page
                    .getByText(/未找到教学班|No sections found/i)
                    .filter({ visible: true }),
                ).toBeVisible();
                await page
                  .getByRole("link", { name: /^(清除|Clear)$/i })
                  .click();
                await waitForUiSettled(page);
                await expect(rows).toHaveCount(3);

                const semester = await openCatalogColumnFilter(
                  page,
                  /^(学期|Semester)$/i,
                );
                await expect(semester.getByRole("checkbox")).toHaveCount(2);
                await setCatalogFilterValue(semester, "semesterId", "2609");
                await applyCatalogFilters(page);
                await expect(rows).toHaveCount(2);
                const teacher = await openCatalogColumnFilter(
                  page,
                  /^(教师|Teachers)$/i,
                );
                await setCatalogFilterValue(teacher, "teacher", "Lin");
                await applyCatalogFilters(page);
                await expect(rows).toHaveCount(1);
                await expect(rows).toHaveAttribute(
                  "href",
                  "/catalog/sections/910001",
                );
                const credits = await openCatalogColumnFilter(
                  page,
                  /^(学分|Credits)$/i,
                );
                const numeric = credits.locator(
                  '[data-filter-field="credits"]',
                );
                await numeric.getByRole("combobox").selectOption("gte");
                await numeric.locator("input").first().fill("4");
                await applyCatalogFilters(page);
                await expect(rows).toHaveCount(1);
                await page.getByRole("searchbox").fill("Physics");
                await applyCatalogFilters(page);
                await expect(rows).toHaveCount(0);
                await expect(
                  page
                    .getByText(/未找到教学班|No sections found/i)
                    .filter({ visible: true }),
                ).toBeVisible();
                await page.screenshot({
                  path: testInfo.outputPath(
                    `after-empty-${locale}-${width}.png`,
                  ),
                  fullPage: true,
                });
                await page
                  .getByRole("link", { name: /^(清除|Clear)$/i })
                  .click();
                await waitForUiSettled(page);
                await expect(rows).toHaveCount(3);
                const search = "teacher:Lin sort:credits order:desc";
                await page.getByRole("searchbox").fill(search);
                await applyCatalogFilters(page);
                await expect(rows).toHaveCount(2);
                expect(
                  await rows.evaluateAll((links) =>
                    links.map((link) => link.getAttribute("href")),
                  ),
                ).toEqual([
                  "/catalog/sections/910001",
                  "/catalog/sections/910003",
                ]);
                const response = await page.request.get(
                  `/api/catalog/sections?${new URLSearchParams({ search })}`,
                );
                expect(response.status()).toBe(200);
                const body = await response.json();
                expect(
                  body.data.map((row: { jwId: number }) => row.jwId),
                ).toEqual([910001, 910003]);
                expect(body.data[0].course.namePrimary).toBe(
                  locale === "en-us" ? "Linear Algebra" : "线性代数",
                );
                await rows.first().click();
                await waitForUiSettled(page);
                await expect(page).toHaveURL(/\/catalog\/sections\/910001$/);
                await expect(page.getByTestId("demo-notice")).toBeVisible();
                await expect(
                  page.locator('a[href$=".ics"]:visible'),
                ).toHaveCount(0);
                await page
                  .locator(
                    '#main-content a[href="/catalog/courses/920001"]:visible',
                  )
                  .click();
                await waitForUiSettled(page);
                await expect(page.getByTestId("demo-notice")).toBeVisible();
                await expect(
                  page.getByRole("heading", { level: 1 }),
                ).toContainText(
                  locale === "en-us" ? "Linear Algebra" : "线性代数",
                );
              }),
            ),
          ),
        );
      },
    );
  }
}
