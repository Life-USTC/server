/**
 * E2E tests for the Dashboard Home Page (`/`)
 *
 * ## Data Represented
 * - **Public (unauthenticated):** PublicHomeView with "bus" and "links" entries
 *   in the sidebar. Auth-only dashboard sub-pages (overview, calendar, homeworks,
 *   todos, exams, subscriptions) are not accessible. A sign-in CTA is displayed.
 *   Default public tab is "bus".
 * - **Authenticated:** Dashboard pages are nested under the "Dashboard" group in
 *   the sidebar: overview (default), calendar, homeworks, todos, exams,
 *   subscriptions. Bus and links live in the "Public tools" group.
 *
 * ## UI/UX Elements
 * - Sidebar navigation with collapsible groups
 * - User menu visible when authenticated; sign-in CTA when not
 *
 * ## Edge Cases
 * - `?tab=homeworks` for unauthenticated users falls back to public bus tab
 * - Invalid `?tab=` values default to "overview" (auth) or "bus" (public)
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../utils/auth";
import { DEV_SEED } from "../../../utils/dev-seed";
import {
  expandDashboardSidebarGroup,
  sidebarDashboardLink,
} from "../../../utils/locators";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { captureStepScreenshot } from "../../../utils/screenshot";
import { ensureSeedSectionSubscription } from "../../../utils/subscriptions";

test.describe("仪表盘", () => {
  test("未登录 ?tab=homeworks 显示公共校车视图", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, "/?tab=homeworks", {
      testInfo,
      screenshotLabel: "dashboard",
    });

    await expect(page).toHaveURL(/\/\?tab=homeworks$/);
    await expect(page.locator("#app-logo")).toBeVisible();

    // Public view shows bus + links entries and sign-in CTA
    await expect(
      page.getByRole("link", { name: /^(校车|Shuttle Bus)$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /^(登录|Sign in)$/i }).first(),
    ).toBeVisible();

    // Auth-only dashboard entries should not be present
    await expect(
      page.getByRole("link", { name: /^(总览|Overview)$/i }),
    ).toHaveCount(0);

    await captureStepScreenshot(page, testInfo, "home-public-with-tab");
  });

  test("登录后首页显示总览、所有标签和种子数据", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/", {
      testInfo,
      screenshotLabel: "dashboard",
    });

    await expect(page).toHaveURL(/\/(?:\?.*)?$/);
    await expect(page.locator("#main-content")).toBeVisible();
    await expect(page.locator("#app-user-menu")).toBeVisible();

    // Dashboard sidebar group can be expanded to show the auth-only sub-pages
    await expandDashboardSidebarGroup(page);
    for (const label of [
      /^(工作台首页|Workspace start)$/i,
      /^(工作台日程|Workspace schedule)$/i,
      /^(工作台网站目录|Workspace web directory)$/i,
    ]) {
      await expect(sidebarDashboardLink(page, label)).toBeVisible();
    }

    // Seed homework title visible on overview. Retry the subscription+reload
    // because other E2E slices exercise subscription replacement for the
    // shared debug user. The initial sign-in goto stays outside the retry.
    await expect(async () => {
      await ensureSeedSectionSubscription(page);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(
        page.getByText(DEV_SEED.homeworks.title).first(),
      ).toBeVisible({
        timeout: 2_000,
      });
    }).toPass({ timeout: 15_000 });
    await expect(
      page.locator('form[action="/api/dashboard-links/visit"]'),
    ).toHaveCount(DEV_SEED.dashboardLinks.overviewLimit);

    await captureStepScreenshot(page, testInfo, "dashboard-home");
  });

  test("可通过侧边栏导航到作业标签", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/");
    await expandDashboardSidebarGroup(page);

    const homeworksTab = sidebarDashboardLink(
      page,
      /^(工作台任务|Workspace assignments)$/i,
    );
    await expect(homeworksTab).toBeVisible();
    await homeworksTab.click();

    await expect(page).toHaveURL(/\/dashboard\/homeworks(?:\?.*)?$/);
    await captureStepScreenshot(page, testInfo, "dashboard-navigate-homeworks");
  });

  test("仪表盘路径别名渲染匹配的标签", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/links");
    await gotoAndWaitForReady(page, "/dashboard/links", {
      testInfo,
      screenshotLabel: "dashboard-links-path",
    });
    const linksDashboardTab = sidebarDashboardLink(
      page,
      /^(工作台网站目录|Workspace web directory)$/i,
    );
    await expect(linksDashboardTab).toBeVisible();
    await expect(linksDashboardTab).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("searchbox", {
        name: /搜索网站名称或描述|Search by name or description/i,
      }),
    ).toBeVisible();

    await signInAsDebugUser(page, "/dashboard/homeworks");
    const homeworksDashboardTab = sidebarDashboardLink(
      page,
      /^(工作台任务|Workspace assignments)$/i,
    );
    await expect(homeworksDashboardTab).toBeVisible();
    await expect(homeworksDashboardTab).toHaveAttribute("aria-current", "page");

    await gotoAndWaitForReady(page, "/dashboard/subscriptions");
    await expect(page).toHaveURL(/\/dashboard\/subscriptions(?:\?.*)?$/);
    await expect(
      sidebarDashboardLink(
        page,
        /^(工作台课程规划|Workspace course planning)$/i,
      ),
    ).toBeVisible();
    await expect(page.getByText(DEV_SEED.semesterNameCn).first()).toBeVisible();
    await captureStepScreenshot(page, testInfo, "dashboard-subscriptions-path");
  });
});
