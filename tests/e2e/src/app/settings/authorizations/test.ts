import { expect, test } from "@playwright/test";
import {
  expectRequiresSignIn,
  signInAsDebugUser,
} from "../../../../utils/auth";
import {
  createOAuthAuthorizationFixture,
  deleteOAuthClientsByName,
  getCurrentSessionUser,
} from "../../../../utils/e2e-db";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";

test.describe.configure({ mode: "serial" });

test.describe("/settings/authorizations OAuth 授权", () => {
  test("需要登录", async ({ page }, testInfo) => {
    await expectRequiresSignIn(page, "/settings/authorizations");
    await captureStepScreenshot(
      page,
      testInfo,
      "settings-authorizations-unauthorized",
    );
  });

  test("仅显示安全的客户端信息，并支持确认后立即撤销", async ({
    page,
  }, testInfo) => {
    const name = `E2E Calendar ${Date.now()}`;
    const scopes = ["calendar:read", "profile"];

    await signInAsDebugUser(page, "/settings/authorizations");
    const user = await getCurrentSessionUser(page);
    await deleteOAuthClientsByName(name);
    const authorization = await createOAuthAuthorizationFixture({
      name,
      scopes,
      userId: user.id,
    });

    try {
      await gotoAndWaitForReady(page, "/settings/authorizations");
      await page.locator("#app-user-menu").getByRole("button").click();
      const menuLink = page.getByRole("menuitem", {
        name: /已授权应用|Authorized apps/i,
      });
      await expect(menuLink).toHaveAttribute(
        "href",
        "/settings/authorizations",
      );
      await expect(menuLink).toHaveAttribute("aria-current", "page");
      await page.keyboard.press("Escape");

      const region = page.getByRole("region", {
        name: /已授权的 OAuth 应用|Authorized OAuth applications/i,
      });
      await expect(region).toBeVisible();
      await expect(region.getByText(name, { exact: true })).toBeVisible();
      await expect(region.getByText(authorization.clientUri)).toBeVisible();
      for (const scope of scopes) {
        await expect(region.getByText(scope, { exact: true })).toBeVisible();
      }

      const pageText = await page.locator("#main-content").innerText();
      expect(pageText).not.toContain(authorization.clientId);
      expect(pageText).not.toContain(authorization.clientSecret);
      expect(pageText).not.toContain(authorization.redirectUri);

      const revokeButton = region
        .getByRole("button", { name: /撤销|Revoke/i })
        .first();
      await revokeButton.click();
      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toContainText(name);
      await dialog.getByRole("button", { name: /取消|Cancel/i }).click();
      await expect(dialog).not.toBeVisible();
      await expect(region.getByText(name, { exact: true })).toBeVisible();

      await revokeButton.click();
      await dialog.getByRole("button", { name: /撤销|Revoke/i }).click();

      await expect(dialog).not.toBeVisible();
      await expect(page).toHaveURL(
        /\/settings\/authorizations\?message=AuthorizationRevoked$/,
      );
      await expect(
        page.getByText(/已撤销应用授权|Application access revoked/i),
      ).toBeVisible();
      await expect(region.getByText(name, { exact: true })).toHaveCount(0);
      await expect(
        region.getByText(/暂无已授权应用|No authorized applications/i),
      ).toBeVisible();
      await captureStepScreenshot(
        page,
        testInfo,
        "settings-authorizations-revoked",
      );
    } finally {
      await deleteOAuthClientsByName(name);
    }
  });
});
