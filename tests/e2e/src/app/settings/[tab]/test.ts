/**
 * E2E tests for settings route variants (`/account/settings/<tab>`).
 */
import { expect } from "@playwright/test";
import { expectRequiresSignIn } from "../../../../utils/auth";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { test } from "../../../../utils/settings-fixture";

test.describe.configure({ mode: "parallel" });

test("/account/settings 别名路由需要登录", { tag: "@Account/Web" }, async ({
  page,
}) => {
  await expectRequiresSignIn(page, "/account/settings/profile");
});

test("/account/settings/profile 别名路由生效", { tag: "@Account/Web" }, async ({
  accountRun,
  page,
  account: _account,
}) => {
  await accountRun({ writes: [], audits: [] }, async () => {
    await gotoAndWaitForReady(page, "/account/settings/profile");
    await gotoAndWaitForReady(page, "/account/settings/profile");

    await expect(page).toHaveURL(
      /\/account\/settings(?:\/profile)?(?:[/?#].*)?$/,
    );
    await expect(page.locator("input#name")).toBeVisible();
  });
});

test("legacy query settings tabs 的 GET/HEAD 永久跳转到语义分区", {
  tag: "@Account/Web",
}, async ({ page }) => {
  for (const [tab, path] of [
    ["profile", "/account/settings/profile"],
    ["accounts", "/account/settings/accounts"],
    ["security", "/account/settings/security"],
    ["content", "/account/settings/profile"],
    ["danger", "/account/settings/danger"],
    ["preferences", "/account/settings/preferences"],
    ["appearance", "/account/settings/preferences"],
    ["language", "/account/settings/preferences"],
  ] as const) {
    for (const method of ["GET", "HEAD"]) {
      const response = await page.request.fetch(
        `/account/settings?tab=${tab}&message=Success`,
        { maxRedirects: 0, method },
      );

      expect(response.status()).toBe(308);
      expect(response.headers().location).toBe(`${path}?message=Success`);
    }
  }
});

test("/account/settings 无效别名返回 404", { tag: "@Account/Web" }, async ({
  accountRun,
  page,
  account: _account,
}) => {
  await accountRun({ writes: [], audits: [] }, async () => {
    await gotoAndWaitForReady(page, "/account/settings/profile");
    await gotoAndWaitForReady(page, "/account/settings/not-a-tab", {
      expectMainContent: false,
    });

    await expect(page.locator("h1")).toHaveText("404");
  });
});
