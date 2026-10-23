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
import { expect } from "@playwright/test";
import { expectRequiresSignIn } from "../../../utils/auth";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { expectSettingsPage, test } from "../../../utils/settings-fixture";

test.describe.configure({ mode: "parallel" });

test.describe("/account/settings 设置中心", () => {
  test("需要登录", { tag: "@Account/Web" }, async ({ page }) => {
    await expectRequiresSignIn(page, "/account/settings");
  });

  test("ui.settings-navigation-2", { tag: "@Account/Web" }, async ({
    accountRun,
    page,
    account,
  }) => {
    await accountRun({ writes: [], audits: [] }, async () => {
      await gotoAndWaitForReady(page, "/account/settings");

      await expect(page).toHaveURL(/\/account\/settings\/profile(?:\?.*)?$/);
      await expect(page.locator("input#name")).toBeVisible();
      await expect(page.locator("input#username")).toHaveValue(
        account.username ?? "",
      );
      await expect(page.locator("footer")).toHaveCount(0);
    });
  });

  test("ui.settings-navigation-1", { tag: "@Account/Web" }, async ({
    accountRun,
    page,
    account: _account,
  }) => {
    await accountRun({ writes: [], audits: [] }, async () => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await gotoAndWaitForReady(page, "/account/settings");

      const sidebar = page.getByTestId("settings-sidebar");
      const back = page.getByTestId("settings-sidebar-back");
      const activePanel = page.locator("[data-settings-active-panel]");
      await expect(
        sidebar.getByRole("link", { name: /个人资料|Profile/i }),
      ).toHaveAttribute("aria-current", "page");
      await expect(back).toHaveAttribute("href", "/");
      await expect(
        sidebar.getByRole("link", { name: /^(总览|Overview)$/i }),
      ).toHaveCount(0);
      await expect(page.getByTestId("detail-section-nav")).toHaveCount(0);
      const sidebarBox = await sidebar.boundingBox();
      const panelBox = await activePanel.boundingBox();
      expect(sidebarBox?.x).toBeLessThan(panelBox?.x ?? 0);
      await back.click();
      await page.waitForURL(/\/(?:workspace\/overview)?(?:\?.*)?$/);
      await expect(page.getByTestId("settings-sidebar")).toHaveCount(0);
      await expect(page.getByTestId("settings-sidebar-back")).toHaveCount(0);
      const appSidebar = page.getByTestId("app-sidebar");
      const home = appSidebar.getByRole("link", {
        name: "Life@USTC",
        exact: true,
      });
      await expect(home).toBeVisible();
      await expect(home).toHaveAttribute("href", "/");
      await expect(home).toHaveAttribute("aria-current", "page");
      await expect(
        appSidebar.locator(
          'a[href="/catalog/features"], a[href="/workspace/overview"]',
        ),
      ).toHaveCount(0);

      await page.setViewportSize({ width: 390, height: 844 });
      await gotoAndWaitForReady(page, "/account/settings/danger");
      await page.locator('[data-slot="sidebar-trigger"]').click();
      const mobileSidebar = page.getByTestId("settings-sidebar");
      await expect(mobileSidebar).toBeVisible();
      await expect(page.getByTestId("settings-sidebar-back")).toBeVisible();
      await expect(
        mobileSidebar.getByRole("link", { name: /危险操作|Danger zone/i }),
      ).toHaveAttribute("aria-current", "page");
    });
  });

  test("ui.settings-navigation-6", { tag: "@Account/Web" }, async ({
    accountRun,
    isolatedWorker,
    page,
    account: _account,
  }) => {
    await accountRun({ writes: [], audits: [] }, async () => {
      await page
        .context()
        .addCookies([
          { name: "NEXT_LOCALE", value: "zh-cn", url: isolatedWorker.origin },
        ]);
      await page.setViewportSize({ width: 375, height: 900 });
      await gotoAndWaitForReady(page, "/account/settings/danger");
      await page.locator('[data-slot="sidebar-trigger"]').click();
      const sidebar = page.getByTestId("settings-sidebar");
      const activeLink = sidebar.locator('a[aria-current="page"]');
      await expect(activeLink).toHaveCount(1);
      await expect(activeLink).toBeVisible();
      await expect(page.getByTestId("detail-section-nav")).toHaveCount(0);
    });
  });

  test("标签导航切换分区", { tag: "@Account/Web" }, async ({
    accountRun,
    page,
    account: _account,
  }) => {
    await accountRun({ writes: [], audits: [] }, async () => {
      await gotoAndWaitForReady(page, "/account/settings");

      // Navigate to accounts tab
      const accountsTab = page.getByRole("link", {
        name: /关联账户|Linked accounts/i,
      });
      await expect(accountsTab).toBeVisible();
      await accountsTab.click();
      await expect(page).toHaveURL(/\/account\/settings\/accounts(?:\?.*)?$/);
      await expect(page.getByText("GitHub").first()).toBeVisible();
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
      // Navigate back to profile tab
      const profileTab = page.getByRole("link", {
        name: /个人资料|Profile/i,
      });
      await expect(profileTab).toBeVisible();
      await profileTab.click();
      await expect(page).toHaveURL(/\/account\/settings\/profile(?:\?.*)?$/);
      await expect(page.locator("input#name")).toBeVisible();
    });
  });

  test("ui.settings-navigation-8", {
    tag: "@Account/Web",
  }, async ({ accountRun, page, account: _account }) => {
    await accountRun({ writes: [], audits: [] }, async () => {
      const preferences = page.getByRole("region", {
        name: /偏好设置|Preferences/i,
      });
      const profileGroup = page.getByRole("heading", {
        level: 2,
        name: /个人资料|Profile/i,
      });
      const accountsGroup = page.getByRole("heading", {
        level: 2,
        name: /关联账户|Linked accounts/i,
      });

      await page.setViewportSize({ width: 1440, height: 900 });
      await gotoAndWaitForReady(page, "/account/settings/preferences");

      await expect(preferences).toBeVisible();
      await expect(profileGroup).toBeVisible();
      await expect(accountsGroup).toBeVisible();
      // The requested group keeps the leading column; companions sit beside it.
      const activeBox = await page
        .locator("[data-settings-active-group]")
        .boundingBox();
      const companionBox = await page
        .locator("[data-settings-companion-panel]")
        .boundingBox();
      expect(activeBox?.x).toBeLessThan(companionBox?.x ?? 0);
      await expect(page.locator("[data-settings-danger-region]")).toHaveCount(
        0,
      );

      // Destructive settings never share a canvas with a routine group.
      await gotoAndWaitForReady(page, "/account/settings/danger");
      await expect(page.locator("[data-settings-danger-region]")).toBeVisible();
      await expect(page.locator("[data-settings-companion-panel]")).toHaveCount(
        0,
      );
      await expect(preferences).toHaveCount(0);
      await expect(profileGroup).toHaveCount(0);

      // A narrow canvas renders the requested group alone: companions are not
      // merely hidden, they never reach the phone at all.
      await page.setViewportSize({ width: 390, height: 844 });
      await gotoAndWaitForReady(page, "/account/settings/preferences");

      await expect(preferences).toBeVisible();
      await expect(page.locator("[data-settings-companion-panel]")).toHaveCount(
        0,
      );
      await expect(profileGroup).toHaveCount(0);
      await expect(accountsGroup).toHaveCount(0);
      await expect(page.locator('form[action="?/updateProfile"]')).toHaveCount(
        0,
      );
    });
  });

  test("设置语义路径渲染对应分区", { tag: "@Account/Web" }, async ({
    accountRun,
    page,
    account: _account,
  }) => {
    await accountRun({ writes: [], audits: [] }, async () => {
      await gotoAndWaitForReady(page, "/account/settings/accounts");
      await expect(page).toHaveURL(/\/account\/settings\/accounts(?:\?.*)?$/);
      await expect(page.getByText("GitHub").first()).toBeVisible();

      await gotoAndWaitForReady(page, "/account/settings/danger");
      await expect(
        page.getByRole("button", { name: /删除|Delete/i }).first(),
      ).toBeVisible();

      await gotoAndWaitForReady(page, "/account/settings/profile");
      await expect(page.locator("input#name")).toBeVisible();
    });
  });
});

test("页面契约", { tag: "@Account/Web" }, async ({
  accountRun,
  page,
  account: _account,
}) => {
  await accountRun({ writes: [], audits: [] }, async () => {
    await expectSettingsPage(page, "/account/settings");
    for (const name of [
      /个人资料|Profile/i,
      /账号关联|Accounts/i,
      /危险区|Danger/i,
    ])
      await expect(page.getByRole("link", { name })).toBeVisible();
  });
});
