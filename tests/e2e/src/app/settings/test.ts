/**
 * E2E tests for the Settings Hub Page (`/account/settings`)
 *
 * ## Data Represented
 * - Central settings page using semantic child paths.
 * - Sections: profile (default), preferences, accounts, authorizations, danger.
 * - Each child route renders a different section component server-side.
 * - Layout requires authentication (`requireSignedInUserId`).
 *
 * ## UI/UX Elements
 * - Settings section links in the level-2 sidebar, with a control that returns home
 * - Page title and description
 * - Default tab is "profile" which shows the profile edit form
 *
 * ## Edge Cases
 * - Unauthenticated → redirects to /signin
 * - `/account/settings` and invalid legacy `?tab` values redirect to profile
 */
import { expect, test } from "@playwright/test";
import { expectRequiresSignIn, signInAsDebugUser } from "../../../utils/auth";
import { DEV_SEED } from "../../../utils/dev-seed";
import { PLAYWRIGHT_BASE_URL } from "../../../utils/e2e-db/core";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { captureStepScreenshot } from "../../../utils/screenshot";
import { assertPageContract } from "../_shared/page-contract";

test.describe("/account/settings 设置中心", () => {
  test("需要登录", async ({ page }, testInfo) => {
    await expectRequiresSignIn(page, "/account/settings");
    await captureStepScreenshot(page, testInfo, "settings-unauthorized");
  });

  test("ui.settings-navigation-2", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/account/settings");

    await expect(page).toHaveURL(/\/account\/settings\/profile(?:\?.*)?$/);
    await expect(page.locator("input#name")).toBeVisible();
    await expect(page.locator("input#username")).toHaveValue(
      DEV_SEED.debugUsername,
    );
    await expect(page.locator("footer")).toHaveCount(0);
    await captureStepScreenshot(page, testInfo, "settings-default-profile");
  });

  test("ui.settings-navigation-1", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signInAsDebugUser(page, "/account/settings");

    const sidebar = page.getByTestId("settings-sidebar");
    const back = page.getByTestId("settings-sidebar-back");
    const activePanel = page.locator("[data-settings-active-panel]");
    await expect(
      sidebar.getByRole("link", { name: /个人资料|Profile/i }),
    ).toHaveAttribute("aria-current", "page");
    await expect(back).toHaveAttribute("href", "/");
    await expect(
      sidebar.getByRole("link", { name: /^(今天|Today)$/i }),
    ).toHaveCount(0);
    await expect(page.getByTestId("detail-section-nav")).toHaveCount(0);
    const sidebarBox = await sidebar.boundingBox();
    const panelBox = await activePanel.boundingBox();
    expect(sidebarBox?.x).toBeLessThan(panelBox?.x ?? 0);
    await captureStepScreenshot(page, testInfo, "settings-responsive-desktop");

    await back.click();
    await page.waitForURL(/\/(?:workspace\/overview)?(?:\?.*)?$/);
    await expect(page.getByTestId("settings-sidebar")).toHaveCount(0);
    await expect(page.getByTestId("settings-sidebar-back")).toHaveCount(0);
    await expect(
      page
        .getByTestId("app-sidebar")
        .getByRole("link", { name: /^(今天|Today)$/i }),
    ).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndWaitForReady(page, "/account/settings/danger");
    await page.locator('[data-slot="sidebar-trigger"]').click();
    const mobileSidebar = page.getByTestId("settings-sidebar");
    await expect(mobileSidebar).toBeVisible();
    await expect(page.getByTestId("settings-sidebar-back")).toBeVisible();
    await expect(
      mobileSidebar.getByRole("link", { name: /危险操作|Danger zone/i }),
    ).toHaveAttribute("aria-current", "page");
    await captureStepScreenshot(page, testInfo, "settings-responsive-mobile");
  });

  test("ui.settings-navigation-6", async ({ page }) => {
    await page.context().addCookies([
      {
        name: "NEXT_LOCALE",
        value: "zh-cn",
        url: PLAYWRIGHT_BASE_URL,
      },
    ]);
    await page.setViewportSize({ width: 375, height: 900 });
    await signInAsDebugUser(page, "/account/settings/danger");
    await page.locator('[data-slot="sidebar-trigger"]').click();
    const sidebar = page.getByTestId("settings-sidebar");
    const activeLink = sidebar.locator('a[aria-current="page"]');
    await expect(activeLink).toHaveCount(1);
    await expect(activeLink).toBeVisible();
    await expect(page.getByTestId("detail-section-nav")).toHaveCount(0);
  });

  test("标签导航切换分区", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/account/settings");

    // Navigate to accounts tab
    const accountsTab = page.getByRole("link", {
      name: /关联账户|Linked accounts/i,
    });
    await expect(accountsTab).toBeVisible();
    await accountsTab.click();
    await expect(page).toHaveURL(/\/account\/settings\/accounts(?:\?.*)?$/);
    await expect(page.getByText("GitHub").first()).toBeVisible();
    await captureStepScreenshot(page, testInfo, "settings-accounts-tab");

    // Navigate to danger tab
    const dangerTab = page.getByRole("link", {
      name: /危险操作|Danger zone/i,
    });
    await expect(dangerTab).toBeVisible();
    await dangerTab.click();
    await expect(page).toHaveURL(/\/account\/settings\/danger(?:\?.*)?$/);
    await expect(
      page.getByRole("button", { name: /删除|Delete/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /删除账户|Delete Account/i }),
    ).toBeVisible();
    await expect(page.locator("[data-settings-danger-region]")).toBeVisible();
    await captureStepScreenshot(page, testInfo, "settings-danger-tab");

    // Navigate back to profile tab
    const profileTab = page.getByRole("link", {
      name: /个人资料|Profile/i,
    });
    await expect(profileTab).toBeVisible();
    await profileTab.click();
    await expect(page).toHaveURL(/\/account\/settings\/profile(?:\?.*)?$/);
    await expect(page.locator("input#name")).toBeVisible();
    await captureStepScreenshot(page, testInfo, "settings-profile-tab");
  });

  test("设置语义路径渲染对应分区", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/account/settings/accounts");
    await expect(page).toHaveURL(/\/account\/settings\/accounts(?:\?.*)?$/);
    await expect(page.getByText("GitHub").first()).toBeVisible();

    await gotoAndWaitForReady(page, "/account/settings/danger");
    await expect(
      page.getByRole("button", { name: /删除|Delete/i }).first(),
    ).toBeVisible();

    await gotoAndWaitForReady(page, "/account/settings/profile");
    await expect(page.locator("input#name")).toBeVisible();
    await captureStepScreenshot(page, testInfo, "settings-path-profile");
  });
});

test("页面契约", async ({ page }, testInfo) => {
  await assertPageContract(page, { routePath: "/account/settings", testInfo });
});
