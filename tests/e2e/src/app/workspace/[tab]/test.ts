/**
 * E2E tests for workspace route variants (`/workspace/<tab>`).
 */
import { expect, type Page, test } from "@playwright/test";

import {
  expectRequiresSignIn,
  signInAsDebugUser,
} from "../../../../utils/auth";
import { sidebarNavigationLink } from "../../../../utils/locators";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { assertPageContract } from "../../_shared/page-contract";

async function setLocale(page: Page, locale: "en-us" | "zh-cn") {
  const response = await page.request.post("/api/account/preferences", {
    data: { locale },
  });
  expect(response.status()).toBe(200);
}

async function expectWorkspacePageIdentity(
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
  await captureStepScreenshot(page, testInfo, "workspace-homeworks-unauth");
});

test("匿名工作区重定向后仍可登录并加载标签", async ({ page }, testInfo) => {
  // Regression: the anonymous workspace module must not initialize Better
  // Auth in a request context that ends with the sign-in redirect.
  await expectRequiresSignIn(page, "/workspace/homeworks");
  await signInAsDebugUser(page, "/workspace/homeworks");
  await gotoAndWaitForReady(page, "/workspace/homeworks", {
    testInfo,
    screenshotLabel: "workspace-homeworks",
  });

  await expect(page).toHaveURL(/\/workspace\/homeworks(?:[/?#].*)?$/);
  await expect(
    sidebarNavigationLink(page, /^(作业|Homework)$/i),
  ).toHaveAttribute("aria-current", "page");
  await captureStepScreenshot(page, testInfo, "workspace-homeworks");
});

test("登录工作区隐藏公共页脚但公共内容页保留", async ({ page }) => {
  await signInAsDebugUser(page, "/workspace/overview");
  await expect(page.locator("footer")).toHaveCount(0);

  await gotoAndWaitForReady(page, "/catalog/courses");
  await expect(page.locator("footer")).toBeVisible();
});

test("查询参数别名永久跳转后使用规范化的工作台页面身份", async ({ page }) => {
  await setLocale(page, "zh-cn");
  await signInAsDebugUser(page, "/workspace/todos");
  await gotoAndWaitForReady(page, "/workspace?tab=todos");

  await expect(page).toHaveURL(/\/workspace\/todos$/);
  await expectWorkspacePageIdentity(page, "zh-cn", "待办");
});

test("页面契约", async ({ page }, testInfo) => {
  await assertPageContract(page, {
    routePath: "/workspace/overview",
    testInfo,
  });
});

test("页面契约 /workspace", async ({ page }, testInfo) => {
  await assertPageContract(page, { routePath: "/workspace", testInfo });
});
