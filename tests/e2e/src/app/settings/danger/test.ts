import { createLocalAccountIssuer } from "@better-auth/core/db";
/**
 * E2E tests for the Settings Danger section (`/account/settings/danger`)
 *
 * ## Data Represented
 * - `/account/settings/danger` is the canonical destructive settings entry.
 * - The danger section provides irreversible account deletion.
 * - Card styled with destructive border to signal danger.
 *
 * ## UI/UX Elements
 * - Card: destructive-themed with title "Delete Account" / "删除账号"
 * - "Delete Account" button → opens confirmation dialog
 * - Alert dialog contains:
 *   - Warning title and description
 *   - Text input with placeholder "DELETE" — must type exact phrase
 *   - Cancel button → closes dialog
 *   - Confirm delete button — disabled until input matches "DELETE"
 * - Toast notifications for deletion success/error
 *
 * ## Edge Cases
 * - Unauthenticated → redirects to /signin
 * - Partial confirmation text (e.g. "DEL") → confirm button stays disabled
 * - Cancel → dialog closes, no action taken
 * - Actual deletion signs the user out and redirects to /
 * - Deleted credentials stop working; a newly arranged private identity can sign in
 */
import { expect, type Route } from "@playwright/test";
import { expectPagePath, expectRequiresSignIn } from "../../../../utils/auth";

import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { absoluteTestUrl } from "../../../../utils/request-url";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import {
  expectSettingsPage,
  storedProfile,
  test,
} from "../../../../utils/settings-fixture";

test.describe.configure({ mode: "parallel" });

test.describe("/account/settings/danger 危险区设置", () => {
  test("需要登录", async ({ accountRun, page }, testInfo) => {
    await accountRun({ writes: [], audits: [] }, async () => {
      await expectRequiresSignIn(page, "/account/settings/danger");
      await captureStepScreenshot(
        page,
        testInfo,
        "settings-danger-unauthorized",
      );
    });
  });

  test("删除账号确认流程", async ({
    accountRun,
    page,
    account,
    isolatedWorker,
  }, testInfo) => {
    await accountRun({ writes: [], audits: [] }, async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await gotoAndWaitForReady(page, "/account/settings/danger");

      await expectPagePath(page, "/account/settings/danger");

      // Open the deletion dialog
      const openDialogButton = page
        .getByRole("button", { name: /删除|Delete/i })
        .first();
      const dialog = page.getByRole("alertdialog").last();
      await expect(openDialogButton).toBeVisible();
      await expect(openDialogButton).toBeEnabled();
      await openDialogButton.click();
      await expect(dialog).toBeVisible();
      await expect(
        dialog.locator('input[placeholder="DELETE"]').first(),
      ).toBeVisible();

      const footerButtons = dialog.locator(
        '[data-slot="alert-dialog-footer"] button',
      );
      await expect(footerButtons).toHaveCount(2);
      await expect(footerButtons.nth(0)).toHaveAttribute(
        "data-slot",
        "alert-dialog-cancel",
      );
      await expect(footerButtons.nth(1)).toHaveAttribute(
        "data-slot",
        "alert-dialog-action",
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(390);

      // Escape closes the alert dialog without taking the destructive action.
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();

      await page.setViewportSize({ width: 320, height: 844 });
      const narrowOpenDialogButton = page
        .getByRole("button", { name: /删除|Delete/i })
        .first();
      const narrowDialog = page.getByRole("alertdialog").last();
      const narrowInput = narrowDialog
        .locator('input[placeholder="DELETE"]')
        .first();
      await expect(narrowOpenDialogButton).toBeVisible();
      await expect(narrowOpenDialogButton).toBeEnabled();
      await narrowOpenDialogButton.click();
      await expect(narrowDialog).toBeVisible();
      await expect(narrowInput).toBeVisible();
      const narrowFooterButtons = narrowDialog.locator(
        '[data-slot="alert-dialog-footer"] button',
      );
      await expect(narrowFooterButtons).toHaveCount(2);
      await expect(narrowFooterButtons.nth(0)).toHaveAttribute(
        "data-slot",
        "alert-dialog-cancel",
      );
      await expect(narrowFooterButtons.nth(1)).toHaveAttribute(
        "data-slot",
        "alert-dialog-action",
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(320);

      // Confirm button disabled until exact phrase typed.
      const confirmButton = narrowDialog
        .getByRole("button", { name: /删除|Delete/i })
        .last();
      await expect(confirmButton).toBeDisabled();
      await narrowInput.fill("DEL");
      await expect(confirmButton).toBeDisabled();
      await narrowInput.fill("DELETE");
      await expect(confirmButton).toBeEnabled();
      await captureStepScreenshot(
        page,
        testInfo,
        "settings-danger-confirm-enabled",
      );

      // Cancel closes dialog without action.
      await narrowDialog.getByRole("button", { name: /取消|Cancel/i }).click();
      await expect(narrowDialog).toBeHidden();
      expect(
        await storedProfile(isolatedWorker.database.owner, account.id),
      ).toMatchObject({ id: account.id });
    });
  });

  test("实际删除账号后退出登录并可重新登录", async ({
    accountRun,
    page,
    account,
    credential,
    credentialHash,
    baseURL,
    isolatedWorker,
  }, testInfo) => {
    test.setTimeout(60_000);
    await accountRun(
      {
        writes: [
          ["/account/settings/danger", 200, "deleteAccount", "/"],
          ["/api/auth/sign-in/email", 401],
          ["/api/auth/sign-in/email", 200],
        ],
        audits: ["account_delete", "account_sign_in", "account_sign_in"],
      },
      async () => {
        await gotoAndWaitForReady(page, "/account/settings/danger");
        await expectPagePath(page, "/account/settings/danger");

        // Open the deletion dialog
        const openDialogButton = page
          .getByRole("button", { name: /删除|Delete/i })
          .first();
        await expect(openDialogButton).toBeVisible();
        await expect(openDialogButton).toBeEnabled();
        await openDialogButton.click();
        const openingDialog = page.getByRole("alertdialog").last();
        await expect(openingDialog).toBeVisible();
        await expect(
          openingDialog.locator('input[placeholder="DELETE"]').first(),
        ).toBeVisible();

        const dialog = page.getByRole("alertdialog").last();
        const input = dialog.locator('input[placeholder="DELETE"]').first();
        const confirmButton = dialog
          .getByRole("button", { name: /删除|Delete/i })
          .last();

        await input.fill("DELETE");
        await expect(confirmButton).toBeEnabled();
        await captureStepScreenshot(
          page,
          testInfo,
          "settings-danger-confirm-enabled",
        );

        // Hold the request long enough to assert the pending state keeps the
        // confirmation open and disables both secondary and destructive actions.
        let releaseDeleteRequest!: () => void;
        const deleteRequestGate = new Promise<void>((resolve) => {
          releaseDeleteRequest = resolve;
        });
        const holdDelete = async (route: Route) => {
          if (route.request().method() === "POST") await deleteRequestGate;
          await route.fallback();
        };
        await page.route("**/account/settings/danger**", holdDelete);

        try {
          const signedOutNavigation = page.waitForURL(/\/(?:\?.*)?$/, {
            timeout: 15_000,
          });
          await confirmButton.click();
          await expect(dialog).toBeVisible();
          await expect(confirmButton).toBeDisabled();
          await expect(
            dialog.getByRole("button", { name: /取消|Cancel/i }),
          ).toBeDisabled();
          await expect(
            dialog.locator('[data-icon="inline-start"]'),
          ).toBeVisible();
          releaseDeleteRequest();
          await signedOutNavigation;
        } finally {
          releaseDeleteRequest();
          await page.unroute("**/account/settings/danger**", holdDelete);
        }

        await expect(page).toHaveURL(/\/(?:\?.*)?$/);
        await expect(page.locator("#app-user-menu")).toHaveCount(0);
        await expect(
          page.getByRole("link", { name: /^(登录|Sign in)$/i }).first(),
        ).toBeVisible();
        await captureStepScreenshot(page, testInfo, "settings-danger-deleted");

        expect(
          await storedProfile(isolatedWorker.database.owner, account.id),
        ).toBeNull();
        expect(
          await isolatedWorker.database.owner.account.count({
            where: { userId: account.id },
          }),
        ).toBe(0);
        expect(
          await isolatedWorker.database.owner.session.count({
            where: { userId: account.id },
          }),
        ).toBe(0);
        const origin = absoluteTestUrl("/", baseURL).replace(/\/$/, "");
        expect(
          (
            await page.request.post("/api/auth/sign-in/email", {
              data: credential,
              headers: { origin },
            })
          ).status(),
        ).toBe(401);

        // A new private identity with the released address can authenticate again.
        await isolatedWorker.database.owner.$transaction(async (tx) => {
          await tx.user.create({
            data: {
              id: account.id,
              email: account.email,
              emailVerified: true,
              name: account.name,
              username: account.username,
            },
          });
          await tx.account.create({
            data: {
              userId: account.id,
              provider: "credential",
              issuer: createLocalAccountIssuer("credential"),
              providerAccountId: account.id,
              password: credentialHash,
            },
          });
        });
        const signedIn = await page.request.post("/api/auth/sign-in/email", {
          data: credential,
          headers: { origin },
        });
        expect(signedIn.status()).toBe(200);
        expect((await signedIn.json()).user.id).toBe(account.id);
        await gotoAndWaitForReady(page, "/workspace/overview");
        await expect(page.locator("#app-user-menu")).toBeVisible();
        return async () => {
          expect(
            await storedProfile(isolatedWorker.database.owner, account.id),
          ).toMatchObject({
            id: account.id,
            email: account.email,
            name: account.name,
            username: account.username,
          });
        };
      },
    );
  });
});

test("页面契约", async ({ accountRun, page, account: _account }, testInfo) => {
  await accountRun({ writes: [], audits: [] }, async () => {
    await expectSettingsPage(page, "/account/settings/danger", testInfo);
    await expect(
      page.getByRole("region", { name: /删除账户|Delete Account/i }),
    ).toBeVisible();
  });
});
