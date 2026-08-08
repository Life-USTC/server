/**
 * E2E tests for /admin — Admin entry + primary navigation
 *
 * ## Features
 * - Admin-only: unauthenticated → /signin, non-admin → 404
 * - /admin redirects to /admin/users
 * - Admin tools live in the primary sidebar (no secondary admin nav)
 */
import { expect, test } from "@playwright/test";
import {
  expectRequiresSignIn,
  signInAsDebugUser,
  signInAsDevAdmin,
} from "../../../utils/auth";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { captureStepScreenshot } from "../../../utils/screenshot";
import { assertPageContract } from "../_shared/page-contract";

function adminPrimaryNav(page: import("@playwright/test").Page) {
  return page.getByTestId("app-sidebar").getByRole("navigation", {
    name: /主导航|Primary navigation/i,
  });
}

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

test("/admin 重定向到用户管理", async ({ page }, testInfo) => {
  await signInAsDevAdmin(page, "/admin");
  await expect(page).toHaveURL(/\/admin\/users(?:\?.*)?$/);
  await expect(page.getByTestId("admin-workspace")).toBeVisible();
  await captureStepScreenshot(page, testInfo, "admin/redirect-users");
});

test("/admin 主导航在所有管理页面保持唯一当前位置", async ({
  page,
}, testInfo) => {
  await signInAsDevAdmin(page, "/admin/users");

  const paths = [
    { path: "/admin/users", name: /用户管理|User Management/i },
    { path: "/admin/moderation", name: /内容审核|Moderation/i },
    { path: "/admin/oauth", name: /OAuth|OAuth 客户端/i },
    { path: "/admin/bus", name: /校车管理|Bus Management/i },
  ] as const;

  for (const { path, name } of paths) {
    await gotoAndWaitForReady(page, path);

    const navigation = adminPrimaryNav(page);
    const adminLinks = navigation.locator('a[href^="/admin"]');
    await expect(adminLinks).toHaveCount(4);
    await expect(navigation.getByRole("link", { name })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(navigation.locator('a[aria-current="page"]')).toHaveCount(1);
    await expect(
      page.locator("#main-content").getByRole("heading", { level: 1 }),
    ).toHaveCount(1);
  }

  await expect(page.getByTestId("admin-navigation")).toHaveCount(0);
  await captureStepScreenshot(page, testInfo, "admin/primary-navigation");
});

test("/admin 主导航支持键盘切换", async ({ page }, testInfo) => {
  await signInAsDevAdmin(page, "/admin/oauth");

  const navigation = adminPrimaryNav(page);
  const moderationLink = navigation.getByRole("link", {
    name: /内容审核|Moderation/i,
  });
  await expect(navigation.locator('a[aria-current="page"]')).toHaveAttribute(
    "href",
    "/admin/oauth",
  );
  await moderationLink.focus();
  await expect(moderationLink).toBeFocused();
  await moderationLink.press("Enter");
  await expect(page).toHaveURL(/\/admin\/moderation(?:\?.*)?$/);
  await expect(navigation.locator('a[aria-current="page"]')).toHaveAttribute(
    "href",
    "/admin/moderation",
  );
  await captureStepScreenshot(page, testInfo, "admin/navigation-keyboard");
});

test("/admin 主导航可跳转到各管理工具", async ({ page }, testInfo) => {
  await signInAsDevAdmin(page, "/admin/users");

  const navigation = adminPrimaryNav(page);
  const hops = [
    {
      name: /内容审核|Moderation/i,
      url: /\/admin\/moderation(?:\?.*)?$/,
      shot: "admin/navigate-moderation",
    },
    {
      name: /OAuth|OAuth 客户端/i,
      url: /\/admin\/oauth(?:\?.*)?$/,
      shot: "admin/navigate-oauth",
    },
    {
      name: /校车管理|Bus Management/i,
      url: /\/admin\/bus(?:\?.*)?$/,
      shot: "admin/navigate-bus",
    },
    {
      name: /用户管理|User Management/i,
      url: /\/admin\/users(?:\?.*)?$/,
      shot: "admin/navigate-users",
    },
  ] as const;

  for (const { name, url, shot } of hops) {
    const link = navigation.getByRole("link", { name });
    await expect(link).toBeVisible();
    await Promise.all([page.waitForURL(url), link.click()]);
    await captureStepScreenshot(page, testInfo, shot);
  }
});

test("页面契约", async ({ page }, testInfo) => {
  await assertPageContract(page, { routePath: "/admin", testInfo });
});
