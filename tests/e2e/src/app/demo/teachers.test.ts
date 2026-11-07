import { expect } from "@playwright/test";
import { createSignedDemoCookie } from "../../../../shared/demo-token";
import { withBrowserWorkflow } from "../../../utils/browser-workflow";
import { applyCatalogFilters } from "../../../utils/catalog-table-filters";
import { test } from "../../../utils/owned-worker";
import {
  expectNoPageHorizontalOverflow,
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../utils/page-ready";
import { expectRenderedUiQuality } from "../../../utils/ui-quality";

test.use({ workerBindings: { DEMO_ENABLED: "1", E2E_DEBUG_AUTH: "0" } });
for (const locale of ["zh-cn", "en-us"] as const)
  for (const width of [1280, 390]) {
    test(
      `demo.teachers: read-only browsing ${locale} ${width}`,
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
                    `after-navigation-${locale}-${width}.png`,
                  ),
                  fullPage: true,
                });
                if (width === 1280) {
                  await page
                    .locator('a[href="/catalog/teachers"]:visible')
                    .click();
                  await waitForUiSettled(page);
                } else await gotoAndWaitForReady(page, "/catalog/teachers");
                await expect(
                  page.getByRole("heading", { level: 1 }),
                ).toHaveText(locale === "en-us" ? "All Teachers" : "所有教师");
                await expect(page.getByTestId("demo-notice")).toContainText(
                  locale === "en-us" ? "Read only" : "只读",
                );
                const links = page.locator(
                  '#main-content a[href^="/catalog/teachers/"]:not([href*="#"]):visible',
                );
                await expect(links).toHaveCount(2);
                expect(
                  await links.evaluateAll((items) =>
                    items.map((item) => item.getAttribute("href")),
                  ),
                ).toEqual(["/catalog/teachers/402", "/catalog/teachers/401"]);
                await expect(links.first()).toContainText(
                  locale === "en-us" ? "Teacher Lin" : "林老师",
                );
                const counts = page
                  .getByTestId("teacher-section-count")
                  .filter({ visible: true });
                await expect(counts).toHaveText(["2", "2"]);

                await expect(
                  page.locator('script[src*="googletagmanager.com"]'),
                ).toHaveCount(0);
                await expectRenderedUiQuality(page);
                await expectNoPageHorizontalOverflow(page);
                await page.screenshot({
                  path: testInfo.outputPath(`after-${locale}-${width}.png`),
                  fullPage: true,
                });
                const search = page.locator("#teacher-filters-search");
                await search.fill("LIVE-ONLY");
                await applyCatalogFilters(page);
                await expect(links).toHaveCount(0);
                await expect(
                  page
                    .getByText(/未找到教师|No teachers found/i)
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
                await expect(links).toHaveCount(2);
                await search.fill("teacher chen");
                await applyCatalogFilters(page);
                await expect(links).toHaveCount(1);
                await expect(links).toHaveAttribute(
                  "href",
                  "/catalog/teachers/401",
                );
                const response = await page.request.get(
                  "/api/catalog/teachers?search=teacher%20chen",
                );
                expect(response.status()).toBe(200);
                expect((await response.json()).data).toMatchObject([
                  { id: 401, _count: { sections: 2 } },
                ]);
                await links.click();
                await waitForUiSettled(page);
                await expect(page).toHaveURL(/\/catalog\/teachers\/401$/);
                await expect(page.getByTestId("demo-notice")).toBeVisible();
                await expect(
                  page.locator('a[href$=".ics"]:visible'),
                ).toHaveCount(0);
              }),
            ),
          ),
        );
      },
    );
  }
