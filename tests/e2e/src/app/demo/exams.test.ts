import { expect } from "@playwright/test";
import { createSignedDemoCookie } from "../../../../shared/demo-token";
import { withBrowserWorkflow } from "../../../utils/browser-workflow";
import { expectNavigationCount } from "../../../utils/navigation-count";
import { test as workerTest } from "../../../utils/owned-worker";
import {
  expectNoPageHorizontalOverflow,
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../utils/page-ready";
import { expectRenderedUiQuality } from "../../../utils/ui-quality";
import {
  applyWorkspaceTaskFilter,
  openWorkspaceTaskFilter,
  workspaceTaskFilterValue,
} from "../../../utils/workspace-task-filters";

const test = workerTest.extend<{
  browserRun: (work: () => Promise<void>) => Promise<void>;
}>({
  browserRun: async ({ page, run }, use) => {
    await withBrowserWorkflow(page, async (workflow) => {
      await use((work) => workflow.run(() => run(() => workflow.body(work))));
    });
  },
});
test.use({ workerBindings: { DEMO_ENABLED: "1", E2E_DEBUG_AUTH: "0" } });
for (const locale of ["zh-cn", "en-us"] as const) {
  for (const width of [1280, 390]) {
    test(
      `demo.exams: read-only browsing ${locale} ${width}`,
      { tag: "@Account/Web" },
      async ({ page, isolatedWorker, browserRun }, testInfo) => {
        await browserRun(async () => {
          const names =
            locale === "en-us"
              ? ["Linear Algebra", "College Physics", "Data Structures"]
              : ["线性代数", "大学物理", "数据结构"];
          await page.setViewportSize({ width, height: 844 });
          await page.context().addCookies([
            {
              ...(await createSignedDemoCookie({
                issuedAt: Math.floor(Date.now() / 1000),
              })),
              url: isolatedWorker.origin,
            },
            { name: "NEXT_LOCALE", value: locale, url: isolatedWorker.origin },
          ]);
          await gotoAndWaitForReady(page, "/workspace/subscriptions");
          await page.screenshot({
            path: testInfo.outputPath(
              `after-subscriptions-${locale}-${width}.png`,
            ),
            fullPage: true,
          });
          if (width === 1280) {
            const link = page.locator('a[href="/workspace/exams"]:visible');
            await expectNavigationCount(
              page.locator('[data-shell-navigation="desktop"]'),
              "/workspace/exams",
              2,
              locale === "en-us" ? "exams" : "考试",
            );
            await link.click();
            await waitForUiSettled(page);
          } else {
            await gotoAndWaitForReady(page, "/workspace/exams");
          }
          await expect(page).toHaveURL(/\/workspace\/exams$/);
          await expect(page.getByRole("heading", { level: 1 })).toHaveText(
            locale === "en-us" ? "Exams" : "考试",
          );
          await expect(page.getByTestId("demo-notice")).toContainText(
            locale === "en-us" ? "Read only" : "只读",
          );
          await expect(
            page.locator('script[src*="googletagmanager.com"]'),
          ).toHaveCount(0);
          const surface =
            width === 1280
              ? page.getByRole("table")
              : page.getByTestId("workspace-exams-cards");
          await expect(
            surface.getByRole("link", { name: names[0], exact: true }),
          ).toBeVisible();
          await expect(
            surface.getByRole("link", { name: names[1], exact: true }),
          ).toBeVisible();
          await expect(
            surface.getByRole("link", { name: names[2], exact: true }),
          ).toHaveCount(0);
          await expect(surface).toContainText("14:00");
          await expect(surface).toContainText("16:00");
          await expectRenderedUiQuality(page);
          await expectNoPageHorizontalOverflow(page);
          await page.screenshot({
            path: testInfo.outputPath(`after-${locale}-${width}.png`),
            fullPage: true,
          });
          for (const [filter, shown] of [
            ["all", names],
            ["completed", [names[2]]],
            ["incomplete", names.slice(0, 2)],
          ] as const) {
            await openWorkspaceTaskFilter(page, "exams");
            await applyWorkspaceTaskFilter(
              page,
              workspaceTaskFilterValue(page, filter),
            );
            await page.keyboard.press("Escape");
            for (const name of names) {
              const link = surface.getByRole("link", { name, exact: true });
              if (shown.includes(name)) await expect(link).toBeVisible();
              else await expect(link).toHaveCount(0);
            }
          }
          for (const [jwId, examId, date] of [
            [910001, 801, "2027-01-08T00:00:00+08:00"],
            [910002, 802, "2027-01-08T00:00:00+08:00"],
            [910003, 803, "2026-06-26T00:00:00+08:00"],
          ] as const) {
            const response = await page.request.get(
              `/api/catalog/sections/${jwId}`,
            );
            expect(response.status()).toBe(200);
            const body = await response.json();
            expect(body.exams).toMatchObject([
              { id: examId, examDate: date, startTime: 1400, endTime: 1600 },
            ]);
          }
          const bootstrap = await page.request.get(
            "/_internal/shell-bootstrap",
          );
          expect(await bootstrap.json()).toMatchObject({
            viewer: null,
            navigation: { examsCount: 2, subscribedSectionCount: 3 },
          });
          await surface
            .getByRole("link", { name: names[0], exact: true })
            .click();
          await waitForUiSettled(page);
          await expect(page).toHaveURL(/\/catalog\/sections\/910001$/);
          await expect(page.getByTestId("demo-notice")).toBeVisible();
          await expect(page.locator('a[href$=".ics"]:visible')).toHaveCount(0);
        });
      },
    );
  }
}
