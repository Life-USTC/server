/**
 * E2E tests for the Settings Hub Page (`/settings`)
 *
 * ## Data Represented
 * - Central settings page using tab-based navigation via path aliases or `?tab=`.
 * - Tabs: profile (default), accounts, content, danger.
 * - Each tab renders a different section component server-side.
 * - Layout requires authentication (`requireSignedInUserId`).
 *
 * ## UI/UX Elements
 * - Settings nav bar with 4 tab links (profile, accounts, content, danger)
 * - Page title and description
 * - Default tab is "profile" which shows the profile edit form
 *
 * ## Edge Cases
 * - Unauthenticated → redirects to /signin
 * - No `?tab` param → defaults to profile tab
 * - Invalid `?tab` value → defaults to profile tab
 */
import { expect, test } from "@playwright/test";
import { expectRequiresSignIn, signInAsDebugUser } from "../../../utils/auth";
import { DEV_SEED } from "../../../utils/dev-seed";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { captureStepScreenshot } from "../../../utils/screenshot";

test.describe("/settings 设置中心", () => {
  test("需要登录", async ({ page }, testInfo) => {
    await expectRequiresSignIn(page, "/settings");
    await captureStepScreenshot(page, testInfo, "settings-unauthorized");
  });

  test("默认进入个人资料标签并显示种子用户数据", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/settings");

    await expect(page).toHaveURL(/\/settings(?:\?.*)?$/);
    await expect(page.locator("input#name")).toBeVisible();
    await expect(page.locator("input#username")).toHaveValue(
      DEV_SEED.debugUsername,
    );
    await captureStepScreenshot(page, testInfo, "settings-default-profile");
  });

  test("标签导航切换分区", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/settings");

    // Navigate to accounts tab
    const accountsTab = page.getByRole("link", {
      name: /账号关联|Accounts/i,
    });
    await expect(accountsTab).toBeVisible();
    await accountsTab.click();
    await expect(page).toHaveURL(/\/settings\/accounts|tab=accounts/);
    await expect(page.getByText("GitHub").first()).toBeVisible();
    await captureStepScreenshot(page, testInfo, "settings-accounts-tab");

    // Navigate to danger tab
    const dangerTab = page.getByRole("link", {
      name: /危险区|Danger/i,
    });
    await expect(dangerTab).toBeVisible();
    await dangerTab.click();
    await expect(page).toHaveURL(/\/settings\/danger|tab=danger/);
    await expect(
      page.getByRole("button", { name: /删除|Delete/i }).first(),
    ).toBeVisible();
    await captureStepScreenshot(page, testInfo, "settings-danger-tab");

    // Navigate back to profile tab
    const profileTab = page.getByRole("link", {
      name: /个人资料|Profile/i,
    });
    await expect(profileTab).toBeVisible();
    await profileTab.click();
    await expect(page).toHaveURL(/\/settings\/profile|tab=profile/);
    await expect(page.locator("input#name")).toBeVisible();
    await captureStepScreenshot(page, testInfo, "settings-profile-tab");
  });

  test("设置路径别名渲染对应分区", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/settings/accounts");
    await expect(page).toHaveURL(/\/settings\/accounts(?:\?.*)?$/);
    await expect(page.getByText("GitHub").first()).toBeVisible();

    await gotoAndWaitForReady(page, "/settings/content");
    await expect(
      page.getByRole("link", { name: /浏览班级|Browse sections/i }),
    ).toBeVisible();

    await gotoAndWaitForReady(page, "/settings/danger");
    await expect(
      page.getByRole("button", { name: /删除|Delete/i }).first(),
    ).toBeVisible();

    await gotoAndWaitForReady(page, "/settings/profile");
    await expect(page.locator("input#name")).toBeVisible();
    await captureStepScreenshot(page, testInfo, "settings-path-profile");
  });
});
