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
 * - Cleanup recreates the debug fixture user so later tests stay usable
 */
import { expect, test } from "@playwright/test";
import {
  expectPagePath,
  expectRequiresSignIn,
  signInAsDebugUser,
} from "../../../../utils/auth";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { assertPageContract } from "../../_shared/page-contract";

test.describe("/account/settings/danger 危险区设置", () => {
  test("需要登录", async ({ page }, testInfo) => {
    await expectRequiresSignIn(page, "/account/settings/danger");
    await captureStepScreenshot(page, testInfo, "settings-danger-unauthorized");
  });

  test("删除账号确认流程", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAsDebugUser(
      page,
      "/account/settings/danger",
      "/account/settings/danger",
    );

    await expectPagePath(page, "/account/settings/danger");

    // Open the deletion dialog
    const openDialogButton = page
      .getByRole("button", { name: /删除|Delete/i })
      .first();
    const dialog = page.getByRole("alertdialog").last();
    await expect(openDialogButton).toBeVisible();
    await expect(openDialogButton).toBeEnabled();
    await expect(async () => {
      await openDialogButton.click({ force: true });
      await expect(dialog).toBeVisible();
      await expect(
        dialog.locator('input[placeholder="DELETE"]').first(),
      ).toBeVisible();
    }).toPass({
      timeout: 10_000,
      intervals: [250, 500, 1_000],
    });

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
    await expect(async () => {
      await narrowOpenDialogButton.click({ force: true });
      await expect(narrowDialog).toBeVisible();
      await expect(narrowInput).toBeVisible();
    }).toPass({
      timeout: 10_000,
      intervals: [250, 500, 1_000],
    });
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
  });

  test("实际删除账号后退出登录并可重新登录", async ({ page }, testInfo) => {
    test.setTimeout(60_000);

    await signInAsDebugUser(
      page,
      "/account/settings/danger",
      "/account/settings/danger",
    );
    await expectPagePath(page, "/account/settings/danger");

    // Open the deletion dialog
    const openDialogButton = page
      .getByRole("button", { name: /删除|Delete/i })
      .first();
    await expect(openDialogButton).toBeVisible();
    await expect(openDialogButton).toBeEnabled();
    await expect(async () => {
      await openDialogButton.click({ force: true });
      const dialog = page.getByRole("alertdialog").last();
      await expect(dialog).toBeVisible();
      await expect(
        dialog.locator('input[placeholder="DELETE"]').first(),
      ).toBeVisible();
    }).toPass({
      timeout: 10_000,
      intervals: [250, 500, 1_000],
    });

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
    await page.route("**/account/settings/danger**", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      await deleteRequestGate;
      await route.continue();
    });

    // Submit deletion and wait for the server-side sign-out redirect.
    const signedOutNavigation = page.waitForURL(/\/(?:\?.*)?$/, {
      timeout: 15_000,
    });
    await confirmButton.click();
    await expect(dialog).toBeVisible();
    await expect(confirmButton).toBeDisabled();
    await expect(
      dialog.getByRole("button", { name: /取消|Cancel/i }),
    ).toBeDisabled();
    await expect(dialog.locator('[data-icon="inline-start"]')).toBeVisible();
    releaseDeleteRequest();
    await signedOutNavigation;
    await page.unroute("**/account/settings/danger**");

    await expect(page).toHaveURL(/\/(?:\?.*)?$/);
    await expect(page.locator("#app-user-menu")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /^(登录|Sign in)$/i }).first(),
    ).toBeVisible();
    await captureStepScreenshot(page, testInfo, "settings-danger-deleted");

    // Recreate the debug fixture user so subsequent tests can sign in again
    await signInAsDebugUser(page, "/", "/", { ui: true });
    await expect(page.locator("#app-user-menu")).toBeVisible();
  });
});

test("页面契约", async ({ page }, testInfo) => {
  await assertPageContract(page, {
    routePath: "/account/settings/danger",
    testInfo,
  });
});
