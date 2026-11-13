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
      `demo.courses: read-only browsing ${locale} ${width}`,
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
                await page.screenshot({
                  path: testInfo.outputPath(
                    `after-subscriptions-${locale}-${width}.png`,
                  ),
                  fullPage: true,
                });
                if (width === 1280) {
                  const workspace = page.getByTestId("workspace-sidebar");
                  await expect(workspace).toHaveAttribute(
                    "data-shell-navigation-view",
                    "workspace",
                  );
                  await page.getByTestId("workspace-sidebar-back").click();
                  await expect(workspace).toHaveAttribute(
                    "data-shell-navigation-view",
                    "root",
                  );
                  await workspace
                    .locator('[data-slot="sidebar-content"] a[href="/campus"]')
                    .click();
                  await expect(page).toHaveURL(/\/campus$/);
                  const campus = page.getByTestId("campus-sidebar");
                  await expect(campus).toHaveAttribute(
                    "data-shell-navigation-view",
                    "campus",
                  );
                  await campus.locator('a[href="/catalog/courses"]').click();
                  await waitForUiSettled(page);
                } else {
                  await gotoAndWaitForReady(page, "/catalog/courses");
                }
                await expect(
                  page.getByRole("heading", { level: 1 }),
                ).toHaveText(locale === "en-us" ? "All Courses" : "所有课程");
                await expect(page.getByTestId("demo-notice")).toContainText(
                  locale === "en-us" ? "Read only" : "只读",
                );
                const rows = page.locator(
                  '#main-content a[href^="/catalog/courses/"]:visible',
                );
                await expect(rows).toHaveCount(3);
                expect(
                  await rows.evaluateAll((links) =>
                    links.map((link) => link.getAttribute("href")),
                  ),
                ).toEqual([
                  "/catalog/courses/920003",
                  "/catalog/courses/920001",
                  "/catalog/courses/920002",
                ]);
                await expect(rows.nth(1)).toContainText(
                  locale === "en-us" ? "Linear Algebra" : "线性代数",
                );
                await expect(
                  page.locator('script[src*="googletagmanager.com"]'),
                ).toHaveCount(0);
                await expect(
                  page.locator('[data-slot="endless-scroll"]'),
                ).toHaveCount(0);
                await expectRenderedUiQuality(page);
                await expectNoPageHorizontalOverflow(page);
                await page.screenshot({
                  path: testInfo.outputPath(`after-${locale}-${width}.png`),
                  fullPage: true,
                });

                const name = await openCatalogColumnFilter(
                  page,
                  /^(课程名称|Course Name)$/i,
                );
                await setCatalogFilterValue(name, "name", "Linear");
                await page.keyboard.press("Escape");
                const code = await openCatalogColumnFilter(
                  page,
                  /^(课程代码|Course Code)$/i,
                );
                await setCatalogFilterValue(code, "code", "MATH");
                await page.keyboard.press("Escape");
                await applyCatalogFilters(page);
                await expect(rows).toHaveCount(1);
                await expect(rows).toHaveAttribute(
                  "href",
                  "/catalog/courses/920001",
                );
                await page.locator("#course-filters-search").fill("Physics");
                await applyCatalogFilters(page);
                await expect(rows).toHaveCount(0);
                await expect(
                  page
                    .getByText(/未找到课程|No courses found/i)
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
                await page.locator("#course-filters-search").fill("demo-math");
                await applyCatalogFilters(page);
                await expect(rows).toHaveCount(1);
                const api = await page.request.get(
                  "/api/catalog/courses?search=demo-math",
                );
                expect(api.status()).toBe(200);
                expect((await api.json()).data).toMatchObject([
                  {
                    jwId: 920001,
                    namePrimary:
                      locale === "en-us" ? "Linear Algebra" : "线性代数",
                  },
                ]);
                await rows.click();
                await waitForUiSettled(page);
                await expect(page).toHaveURL(/\/catalog\/courses\/920001$/);
                await expect(page.getByTestId("demo-notice")).toBeVisible();
                await expect(
                  page.locator('a[href$=".ics"]:visible'),
                ).toHaveCount(0);
                const sectionLinks = page.locator(
                  '#main-content a[href="/catalog/sections/910001"]:visible',
                );
                // Desktop history exposes one link per cell; select its code.
                await (width === 1280
                  ? sectionLinks.filter({ hasText: "DEMO-MATH01.01" })
                  : sectionLinks
                ).click();
                await waitForUiSettled(page);
                await expect(page).toHaveURL(/\/catalog\/sections\/910001$/);
                await expect(page.getByTestId("demo-notice")).toBeVisible();
              }),
            ),
          ),
        );
      },
    );
  }
}
