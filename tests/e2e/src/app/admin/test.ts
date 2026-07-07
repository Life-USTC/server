/**
 * E2E tests for /admin — Admin Home Page
 *
 * ## Data Represented (admin.yml → admin-home.display.fields)
 * - Navigation to moderation queues
 * - User management
 * - OAuth client management
 * - Bus data management
 *
 * ## Features
 * - Admin-only page: unauthenticated → /signin, non-admin → 404
 * - Navigation cards link to /admin/users, /admin/moderation, /admin/oauth, /admin/bus
 *
 * ## Edge Cases
 * - Unauthenticated → redirect to /signin (all 3 providers shown)
 * - Regular user → 404
 */
import { expect, test } from "@playwright/test";
import {
  expectRequiresSignIn,
  signInAsDebugUser,
  signInAsDevAdmin,
} from "../../../utils/auth";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { captureStepScreenshot } from "../../../utils/screenshot";

test("/admin 未登录重定向到登录页", async ({ page }, testInfo) => {
  await expectRequiresSignIn(page, "/admin", {
    providers: ["ustc", "github", "google"],
  });
  await captureStepScreenshot(page, testInfo, "admin/unauthorized");
});

test("/admin 普通用户访问返回 404", async ({ page }, testInfo) => {
  await signInAsDebugUser(page, "/admin", "/admin");
  await expect(page.locator("h1")).toHaveText("404");
  await captureStepScreenshot(page, testInfo, "admin/404");
});

test("/admin 管理员访问成功并显示所有导航卡片", async ({ page }, testInfo) => {
  await signInAsDevAdmin(page, "/admin");
  await expect(page).toHaveURL(/\/admin(?:\?.*)?$/);
  await expect(page.locator("#main-content")).toBeVisible();

  // admin.yml admin-home.display.fields: all 4 navigation entries
  await expect(page.locator('a[href="/admin/users"]').first()).toBeVisible();
  await expect(
    page.locator('a[href="/admin/moderation"]').first(),
  ).toBeVisible();
  await expect(page.locator('a[href="/admin/oauth"]').first()).toBeVisible();
  await expect(page.locator('a[href="/admin/bus"]').first()).toBeVisible();

  await captureStepScreenshot(page, testInfo, "admin/home");
});

test("/admin 卡片入口可点击跳转到用户管理和内容审核", async ({
  page,
}, testInfo) => {
  await signInAsDevAdmin(page, "/admin");

  const usersCardLink = page
    .locator("#main-content")
    .getByRole("link", { name: /用户管理|User Management/i });
  await expect(usersCardLink).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/admin\/users(?:\?.*)?$/),
    usersCardLink.click(),
  ]);
  await captureStepScreenshot(page, testInfo, "admin/navigate-users");

  await gotoAndWaitForReady(page, "/admin", {
    testInfo,
    screenshotLabel: "admin",
  });
  const moderationCardLink = page
    .locator("#main-content")
    .getByRole("link", { name: /内容审核|Moderation/i });
  await expect(moderationCardLink).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/admin\/moderation(?:\?.*)?$/),
    moderationCardLink.click(),
  ]);
  await captureStepScreenshot(page, testInfo, "admin/navigate-moderation");
});

test("/admin 卡片入口可点击跳转到 OAuth 和校车管理", async ({
  page,
}, testInfo) => {
  await signInAsDevAdmin(page, "/admin");

  const oauthCard = page
    .locator("#main-content")
    .getByRole("link", { name: /OAuth|OAuth 客户端/i });
  await expect(oauthCard).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/admin\/oauth(?:\?.*)?$/),
    oauthCard.click(),
  ]);
  await captureStepScreenshot(page, testInfo, "admin/navigate-oauth");

  await gotoAndWaitForReady(page, "/admin", {
    testInfo,
    screenshotLabel: "admin",
  });
  const busCard = page
    .locator("#main-content")
    .getByRole("link", { name: /校车管理|Shuttle Bus/i });
  await expect(busCard).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/admin\/bus(?:\?.*)?$/),
    busCard.click(),
  ]);
  await captureStepScreenshot(page, testInfo, "admin/navigate-bus");
});
