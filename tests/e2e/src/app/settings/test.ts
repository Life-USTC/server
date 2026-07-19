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
    await expect(page.locator("footer")).toHaveCount(0);
    await captureStepScreenshot(page, testInfo, "settings-default-profile");
  });

  test("设置导航在移动端紧凑显示并在桌面形成侧栏", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAsDebugUser(page, "/settings");

    const navigation = page.locator("[data-settings-navigation]");
    const activePanel = page.locator("[data-settings-active-panel]");
    const profileLink = navigation.getByRole("link", {
      name: /个人资料|Profile/i,
    });

    await expect(profileLink).toHaveAttribute("aria-current", "page");
    await expect
      .poll(() => {
        const wrapper = navigation.locator("..");
        return Promise.all([
          wrapper.getAttribute("data-overflow-left"),
          wrapper.getAttribute("data-overflow-right"),
        ]);
      })
      .toEqual(["false", "true"]);
    const mobileNavigationBox = await navigation.boundingBox();
    const mobilePanelBox = await activePanel.boundingBox();
    expect(mobileNavigationBox?.height).toBeLessThan(80);
    expect(mobilePanelBox?.y).toBeLessThan(844);
    await captureStepScreenshot(page, testInfo, "settings-responsive-mobile");

    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoAndWaitForReady(page, "/settings");
    const desktopNavigationBox = await navigation.boundingBox();
    const desktopPanelBox = await activePanel.boundingBox();
    expect(desktopNavigationBox?.x).toBeLessThan(desktopPanelBox?.x ?? 0);
    await captureStepScreenshot(page, testInfo, "settings-responsive-desktop");
  });

  test("移动端直接打开末尾标签时当前项保持可见", async ({ page }) => {
    const localeResponse = await page.request.post("/api/locale", {
      data: { locale: "zh-cn" },
    });
    expect(localeResponse.status()).toBe(200);
    await page.setViewportSize({ width: 375, height: 900 });
    await signInAsDebugUser(page, "/settings/danger");

    const navigation = page.locator("[data-settings-navigation]");
    const activeLink = navigation.locator('a[aria-current="page"]');

    for (const width of [280, 320, 375]) {
      await page.setViewportSize({ width, height: 900 });
      await gotoAndWaitForReady(page, "/settings/danger");
      await expect(activeLink).toBeVisible();
      await expect
        .poll(() =>
          navigation.evaluate((nav) => {
            const link = nav.querySelector<HTMLElement>(
              'a[aria-current="page"]',
            );
            const wrapper = nav.parentElement;
            if (!link || !wrapper) return null;
            const linkBox = link.getBoundingClientRect();
            const navBox = nav.getBoundingClientRect();
            const wrapperBox = wrapper.getBoundingClientRect();
            const leftFade = getComputedStyle(wrapper, "::before");
            const rightFade = getComputedStyle(wrapper, "::after");
            const leftFadeWidth = Number.parseFloat(leftFade.width || "0");
            return {
              activeClearOfLeftFade:
                linkBox.left >= wrapperBox.left + leftFadeWidth - 1,
              activeWithinNavigation:
                linkBox.left >= navBox.left - 1 &&
                linkBox.right <= navBox.right + 1,
              documentFitsViewport:
                document.documentElement.scrollWidth <=
                document.documentElement.clientWidth,
              navigationScrollable: nav.scrollWidth > nav.clientWidth,
              navigationScrolled: nav.scrollLeft > 0,
              leftFadeVisible:
                wrapper.dataset.overflowLeft === "true" &&
                leftFade.backgroundImage !== "none",
              rightFadeHidden:
                wrapper.dataset.overflowRight === "false" &&
                rightFade.backgroundImage === "none",
              windowScrollX: window.scrollX,
            };
          }),
        )
        .toEqual({
          activeClearOfLeftFade: true,
          activeWithinNavigation: true,
          documentFitsViewport: true,
          navigationScrollable: true,
          navigationScrolled: true,
          leftFadeVisible: true,
          rightFadeHidden: true,
          windowScrollX: 0,
        });
    }
  });

  test("标签导航切换分区", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/settings");

    // Navigate to accounts tab
    const accountsTab = page.getByRole("link", {
      name: /关联账户|Linked accounts/i,
    });
    await expect(accountsTab).toBeVisible();
    await accountsTab.click();
    await expect(page).toHaveURL(/\/settings\/accounts|tab=accounts/);
    await expect(page.getByText("GitHub").first()).toBeVisible();
    await captureStepScreenshot(page, testInfo, "settings-accounts-tab");

    // Navigate to danger tab
    const dangerTab = page.getByRole("link", {
      name: /危险操作|Danger zone/i,
    });
    await expect(dangerTab).toBeVisible();
    await dangerTab.click();
    await expect(page).toHaveURL(/\/settings\/danger|tab=danger/);
    await expect(
      page.getByRole("button", { name: /删除|Delete/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: /删除账户|Delete Account/i }),
    ).toHaveAttribute("data-settings-danger-region", "true");
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
