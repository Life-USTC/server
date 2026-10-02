import { expect } from "@playwright/test";
import { expectRequiresSignIn } from "../../../../utils/auth";

import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { expectSettingsPage, test } from "../../../../utils/settings-fixture";

test.describe.configure({ mode: "parallel" });

test.describe("/account/settings/authorizations OAuth 授权", () => {
  test("需要登录", async ({ accountRun, page }) => {
    await accountRun({ writes: [], audits: [] }, async () => {
      await expectRequiresSignIn(page, "/account/settings/authorizations");
    });
  });

  test("仅显示安全的客户端信息", async ({
    accountRun,
    page,
    authorization,
  }) => {
    await accountRun({ writes: [], audits: [] }, async () => {
      const { name } = authorization;
      await gotoAndWaitForReady(page, "/account/settings/authorizations");
      const region = page.getByRole("region", {
        name: /已授权的 OAuth 应用|Authorized OAuth applications/i,
      });
      const authorizationItem = region
        .getByRole("listitem")
        .filter({ hasText: name });
      await expect(region).toBeVisible();
      await expect(
        authorizationItem.getByText(name, { exact: true }),
      ).toBeVisible();
      await expect(
        authorizationItem.getByText(authorization.clientUri),
      ).toBeVisible();
      for (const scope of [
        /查看您的个人资料|View your profile information/i,
        /读取你的日历|Read your calendar/i,
      ]) {
        await expect(authorizationItem.getByText(scope)).toBeVisible();
      }

      const pageText = await page.locator("#main-content").innerText();
      expect(pageText).not.toContain(authorization.clientId);
      expect(pageText).not.toContain(authorization.clientSecret);
      expect(pageText).not.toContain(authorization.redirectUri);
    });
  });

  test("确认撤销后授权立即消失并持久保存", async ({
    accountRun,
    page,
    account,
    authorization,
    isolatedWorker,
  }) => {
    await accountRun(
      {
        writes: [
          [
            "/account/settings/authorizations",
            200,
            "revokeAuthorization",
            "/account/settings/authorizations?message=AuthorizationRevoked",
          ],
        ],
        audits: ["oauth_authorization_revoke"],
      },
      async () => {
        const { name } = authorization;
        await gotoAndWaitForReady(page, "/account/settings");
        const authorizationsTab = page.getByRole("link", {
          name: /已授权应用|Authorized apps/i,
        });
        await expect(authorizationsTab).toBeVisible();
        await authorizationsTab.click();
        await expect(page).toHaveURL(
          /\/account\/settings\/authorizations(?:\?.*)?$/,
        );
        const region = page.getByRole("region", {
          name: /已授权的 OAuth 应用|Authorized OAuth applications/i,
        });
        const authorizationItem = region
          .getByRole("listitem")
          .filter({ hasText: name });
        const revokeButton = authorizationItem
          .getByRole("button", { name: /撤销|Revoke/i })
          .first();
        await revokeButton.click();
        const dialog = page.getByRole("alertdialog");
        await expect(dialog).toContainText(name);
        await dialog.getByRole("button", { name: /取消|Cancel/i }).click();
        await expect(dialog).not.toBeVisible();
        expect(
          await isolatedWorker.database.owner.oAuthConsent.findUnique({
            where: { id: authorization.consentId },
          }),
        ).toMatchObject({ userId: account.id });
        await expect(
          authorizationItem.getByText(name, { exact: true }),
        ).toBeVisible();

        await revokeButton.click();
        await dialog.getByRole("button", { name: /撤销|Revoke/i }).click();

        await expect(dialog).not.toBeVisible();
        expect(
          await isolatedWorker.database.owner.oAuthConsent.findUnique({
            where: { id: authorization.consentId },
          }),
        ).toBeNull();
        const revokeSuccessText = /已撤销应用授权|Application access revoked/i;
        await expect(page).toHaveURL(/\/account\/settings\/authorizations$/);
        await expect(
          page
            .locator("[data-sonner-toast]")
            .filter({ hasText: revokeSuccessText }),
        ).toBeVisible();
        await expect(
          page
            .locator('[data-slot="alert"][role="alert"]')
            .filter({ hasText: revokeSuccessText }),
        ).toHaveCount(0);
        await expect(region.getByText(name, { exact: true })).toHaveCount(0);
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page).toHaveURL(/\/account\/settings\/authorizations$/);
        await expect(
          page
            .locator("[data-sonner-toast]")
            .filter({ hasText: revokeSuccessText }),
        ).toHaveCount(0);
        await expect(region.getByText(name, { exact: true })).toHaveCount(0);
      },
    );
  });
});

test("页面契约", async ({ accountRun, page, account: _account }) => {
  await accountRun({ writes: [], audits: [] }, async () => {
    await expectSettingsPage(page, "/account/settings/authorizations");
    await expect(
      page.getByRole("region", {
        name: /已授权的 OAuth 应用|Authorized OAuth applications/i,
      }),
    ).toBeVisible();
  });
});
