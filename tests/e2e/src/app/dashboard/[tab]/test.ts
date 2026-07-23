/**
 * E2E tests for dashboard route variants (`/workspace/<tab>`).
 */
import { expect, type Page, test } from "@playwright/test";
import {
  type SignedTabId,
  signedTabIds,
} from "@/features/dashboard/lib/dashboard-nav";
import {
  expectRequiresSignIn,
  signInAsDebugUser,
} from "../../../../utils/auth";
import { sidebarNavigationLink } from "../../../../utils/locators";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";

const dashboardTabRoutes = {
  overview: "/workspace/overview",
  calendar: "/workspace/calendar",
  homeworks: "/workspace/homeworks",
  todos: "/workspace/todos",
  exams: "/workspace/exams",
  subscriptions: "/workspace/subscriptions",
  bus: "/workspace/bus",
  links: "/workspace/links",
} satisfies Record<SignedTabId, string>;

const dashboardTabTitles = {
  "en-us": {
    overview: "Overview",
    calendar: "Calendar",
    homeworks: "Homework",
    todos: "Todos",
    exams: "Exams",
    subscriptions: "Section Subscriptions",
    bus: "Shuttle Bus",
    links: "Websites",
  },
  "zh-cn": {
    overview: "总览",
    calendar: "日历",
    homeworks: "作业",
    todos: "待办",
    exams: "考试",
    subscriptions: "教学班订阅",
    bus: "校车",
    links: "网站",
  },
} satisfies Record<"en-us" | "zh-cn", Record<SignedTabId, string>>;

async function setLocale(page: Page, locale: "en-us" | "zh-cn") {
  const response = await page.request.post("/api/account/preferences", {
    data: { locale },
  });
  expect(response.status()).toBe(200);
}

async function expectDashboardPageIdentity(
  page: Page,
  locale: "en-us" | "zh-cn",
  title: string,
) {
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(page).toHaveTitle(`${title} - Life@USTC`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(
    page.getByRole("heading", { level: 1, name: title, exact: true }),
  ).toHaveCount(1);
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(
    page.getByRole("main", { name: title, exact: true }),
  ).toHaveCount(1);
}

test("/workspace 别名需要登录", async ({ page }, testInfo) => {
  await expectRequiresSignIn(page, "/workspace/homeworks");
  await captureStepScreenshot(page, testInfo, "dashboard-homeworks-unauth");
});

test("/workspace/homeworks 加载登录标签", async ({ page }, testInfo) => {
  await signInAsDebugUser(page, "/workspace/homeworks");
  await gotoAndWaitForReady(page, "/workspace/homeworks", {
    testInfo,
    screenshotLabel: "dashboard-homeworks",
  });

  await expect(page).toHaveURL(/\/workspace\/homeworks(?:[/?#].*)?$/);
  await expect(
    sidebarNavigationLink(page, /^(作业|Homework)$/i),
  ).toHaveAttribute("aria-current", "page");
  await captureStepScreenshot(page, testInfo, "dashboard-homeworks");
});

test("登录工作区隐藏公共页脚但公共内容页保留", async ({ page }) => {
  await signInAsDebugUser(page, "/workspace/overview");
  await expect(page.locator("footer")).toHaveCount(0);

  await gotoAndWaitForReady(page, "/catalog/courses");
  await expect(page.locator("footer")).toBeVisible();
});

for (const locale of ["zh-cn", "en-us"] as const) {
  test(`登录工作台各分支提供唯一页面身份（${locale}）`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    if (locale === "zh-cn") {
      await page.setViewportSize({ width: 390, height: 844 });
    }
    await signInAsDebugUser(page, dashboardTabRoutes.overview);
    await setLocale(page, locale);

    for (const tab of signedTabIds) {
      await gotoAndWaitForReady(page, dashboardTabRoutes[tab]);
      await expectDashboardPageIdentity(
        page,
        locale,
        dashboardTabTitles[locale][tab],
      );

      if (
        (locale === "zh-cn" && tab === "todos") ||
        (locale === "en-us" && tab === "calendar")
      ) {
        await captureStepScreenshot(
          page,
          testInfo,
          `dashboard-page-identity-${locale}-${tab}`,
        );
      }
    }
  });
}

test("查询参数别名永久跳转后使用规范化的工作台页面身份", async ({ page }) => {
  await setLocale(page, "zh-cn");
  await signInAsDebugUser(page, "/workspace/todos");
  await gotoAndWaitForReady(page, "/workspace?tab=todos");

  await expect(page).toHaveURL(/\/workspace\/todos$/);
  await expectDashboardPageIdentity(page, "zh-cn", "待办");
});
