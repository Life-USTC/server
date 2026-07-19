/**
 * E2E tests for invalid tab fallback (`?tab=comments`)
 *
 * ## Data Represented
 * - There is no "comments" tab in the dashboard. Valid authenticated tabs are:
 *   overview, calendar, bus, links, homeworks, todos, exams, subscriptions.
 * - Public bus and links are semantic routes, not home tabs.
 *
 * ## UI/UX Elements
 * - Public view: stays on the lightweight catalog entry
 * - Authenticated view: falls back to overview tab content
 *
 * ## Edge Cases
 * - `?tab=comments` is not a recognized tab value. It does not select another
 *   public resource, while authenticated requests redirect to
 *   `/dashboard/overview`.
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import {
  expandWorkspaceSidebarGroup,
  sidebarNavigationLink,
} from "../../../../utils/locators";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";

test.describe("仪表盘无效标签（comments）", () => {
  test("/dashboard/comments 不是仪表盘路由页面", async ({ page }, testInfo) => {
    const response = await gotoAndWaitForReady(page, "/dashboard/comments", {
      testInfo,
      screenshotLabel: "dashboard-invalid-comments-route",
    });

    expect(response?.status()).toBe(404);
    await expect(page.getByText(/not found|找不到/i)).toBeVisible();
  });

  test("未登录 ?tab=comments 保持轻量公共首页", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, "/?tab=comments", {
      testInfo,
      screenshotLabel: "dashboard-invalid-tab",
    });

    // URL retains the invalid tab param
    await expect(page).toHaveURL(/\/\?tab=comments$/);
    await expect(page.locator("#app-logo")).toBeVisible();

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /先从公开校园工具开始|Start with public campus tools/i,
      }),
    ).toBeVisible();
    await expect(page.getByTestId("bus-compact-summary")).toHaveCount(0);

    await captureStepScreenshot(page, testInfo, "home-comments-public");
  });

  test("登录后 ?tab=comments 回退到总览", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/?tab=comments", "/dashboard/overview");

    await expect(page.locator("#main-content")).toBeVisible();
    await expect(page.locator("#app-user-menu")).toBeVisible();

    // Overview is the fallback — should show the overview sidebar entry as active
    await expandWorkspaceSidebarGroup(page);
    await expect(
      sidebarNavigationLink(page, /^(今天|Today)$/i),
    ).toHaveAttribute("aria-current", "page");

    await captureStepScreenshot(page, testInfo, "home-comments-seed");
  });
});
