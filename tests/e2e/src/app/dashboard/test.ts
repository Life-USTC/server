/**
 * E2E tests for the Dashboard Home Page (`/`)
 *
 * ## Data Represented
 * - **Public (unauthenticated):** A lightweight catalog entry at `/`, with bus
 *   and links exposed as independent public routes.
 * - **Authenticated:** Task destinations are direct links in the "Workspace"
 *   group. Bus, websites, catalog, and campus destinations live in "Explore".
 *
 * ## UI/UX Elements
 * - Sidebar navigation with collapsible groups
 * - User menu visible when authenticated; sign-in CTA when not
 *
 * ## Edge Cases
 * - Recognized legacy `?tab=` values permanently redirect to semantic routes.
 * - Invalid `?tab=` values do not select another public resource.
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../utils/auth";
import { DEV_SEED } from "../../../utils/dev-seed";
import {
  appSidebar,
  expandWorkspaceSidebarGroup,
  sidebarNavigationLink,
} from "../../../utils/locators";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { captureStepScreenshot } from "../../../utils/screenshot";
import { ensureSeedSectionSubscription } from "../../../utils/subscriptions";

test.describe("仪表盘", () => {
  test("未登录旧 homework tab 永久重定向到受保护语义路径", async ({ page }) => {
    const response = await page.request.get(
      "/?tab=homeworks&homeworkView=list",
      {
        maxRedirects: 0,
      },
    );

    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe(
      "/dashboard/homeworks?homeworkView=list",
    );
  });

  test("无效 tab 不再选择其他公共资源", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, "/?tab=unknown", {
      testInfo,
      screenshotLabel: "home-invalid-tab",
    });

    await expect(page).toHaveURL(/\/\?tab=unknown$/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /先从公开校园工具开始|Start with public campus tools/i,
      }),
    ).toBeVisible();
    await expect(page.getByTestId("bus-compact-summary")).toHaveCount(0);
  });

  test("/dashboard 默认永久重定向到 overview 语义路径", async ({ page }) => {
    for (const method of ["GET", "HEAD"]) {
      const response = await page.request.fetch(
        "/dashboard?overviewWeek=next",
        {
          maxRedirects: 0,
          method,
        },
      );

      expect(response.status()).toBe(308);
      expect(response.headers().location).toBe(
        "/dashboard/overview?overviewWeek=next",
      );
    }
  });

  test("登录后首页显示总览、所有标签和种子数据", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await signInAsDebugUser(page, "/");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/", {
      testInfo,
      screenshotLabel: "dashboard",
    });

    await expect(page).toHaveURL(/\/dashboard\/overview(?:\?.*)?$/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /^(总览|Overview)$/,
      }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("main", { name: /^(总览|Overview)$/ }),
    ).toHaveCount(1);
    await expect(page).toHaveTitle(/^(总览|Overview) - Life@USTC$/);
    await expect(page.locator("#app-user-menu")).toBeVisible();

    // Task-oriented workspace destinations are directly reachable.
    await expandWorkspaceSidebarGroup(page);
    for (const label of [
      /^(今天|Today)$/i,
      /^(日历|Calendar)$/i,
      /^(作业|Homework)$/i,
    ]) {
      await expect(sidebarNavigationLink(page, label)).toBeVisible();
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
    const overdueTitle = page
      .getByText(DEV_SEED.homeworks.overdueTitle, { exact: true })
      .first();
    await expect(overdueTitle).toBeVisible();
    const overdueTitleBox = await overdueTitle.boundingBox();
    expect(overdueTitleBox?.width ?? 0).toBeGreaterThan(80);
    expect(overdueTitleBox?.height ?? Number.POSITIVE_INFINITY).toBeLessThan(
      48,
    );
    await expect(
      page.locator('form[action="/api/dashboard-links/visit"]'),
    ).toHaveCount(DEV_SEED.dashboardLinks.overviewLimit);
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);

    await captureStepScreenshot(page, testInfo, "dashboard-home");
  });

  test("可通过侧边栏导航到作业标签", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/");
    await expandWorkspaceSidebarGroup(page);

    const homeworksTab = sidebarNavigationLink(page, /^(作业|Homework)$/i);
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
    const linksDashboardTab = sidebarNavigationLink(page, /^(网站|Websites)$/i);
    await expect(linksDashboardTab).toBeVisible();
    await expect(linksDashboardTab).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("searchbox", {
        name: /搜索网站名称或描述|Search by name or description/i,
      }),
    ).toBeVisible();

    await signInAsDebugUser(page, "/dashboard/homeworks");
    const homeworksDashboardTab = sidebarNavigationLink(
      page,
      /^(作业|Homework)$/i,
    );
    await expect(homeworksDashboardTab).toBeVisible();
    await expect(homeworksDashboardTab).toHaveAttribute("aria-current", "page");

    await gotoAndWaitForReady(page, "/dashboard/subscriptions");
    await expect(page).toHaveURL(/\/dashboard\/subscriptions(?:\?.*)?$/);
    await expect(
      appSidebar(page).getByRole("link", {
        name: /^(关注班级|Section Management)$/i,
      }),
    ).toBeVisible();
    await expect(page.getByText(DEV_SEED.semesterNameCn).first()).toBeVisible();
    await captureStepScreenshot(page, testInfo, "dashboard-subscriptions-path");
  });

  test("移动端总览优先显示此刻与下一步，常用网站保持次要", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await signInAsDebugUser(page, "/");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/", {
      testInfo,
      screenshotLabel: "dashboard-mobile-priority",
    });

    const focus = page.getByTestId("dashboard-overview-focus");
    const links = page.getByTestId("dashboard-overview-links");
    await expect(focus).toBeVisible();
    await expect(focus.getByText(/此刻与下一步|Now & next/i)).toBeVisible();
    await expect(links).toBeVisible();

    const focusBox = await focus.boundingBox();
    const linksBox = await links.boundingBox();
    expect(focusBox?.y).toBeLessThan(linksBox?.y ?? 0);
    expect(focusBox?.y).toBeLessThan(844);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    await captureStepScreenshot(page, testInfo, "dashboard/mobile-priority");
  });

  test("中文总览周视图使用本地化星期标签", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/overview");
    const localeResponse = await page.request.post("/api/locale", {
      data: { locale: "zh-cn" },
    });
    expect(localeResponse.status()).toBe(200);
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/dashboard/overview");
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-cn");

    const weekCard = page
      .getByRole("link", { name: "本周" })
      .locator('xpath=ancestor::*[@data-slot="card"][1]');
    await expect(weekCard).toBeVisible();
    await expect(weekCard.getByText("周日", { exact: true })).toBeVisible();
    await expect(weekCard.getByText("Sun", { exact: true })).toHaveCount(0);
    await captureStepScreenshot(
      page,
      testInfo,
      "dashboard/overview-week-zh-cn",
    );
  });
});
