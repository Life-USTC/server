/**
 * E2E tests for the Settings Danger Tab (`/settings?tab=danger`)
 *
 * ## Data Represented
 * - `/settings?tab=danger` is the canonical destructive settings entry.
 * - The danger section provides irreversible account deletion.
 * - Card styled with destructive border to signal danger.
 *
 * ## UI/UX Elements
 * - Card: destructive-themed with title "Delete Account" / "删除账号"
 * - "Delete Account" button → opens confirmation dialog
 * - Dialog contains:
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

test.describe("/settings?tab=danger 危险区设置", () => {
  test("需要登录", async ({ page }, testInfo) => {
    await expectRequiresSignIn(page, "/settings?tab=danger");
    await captureStepScreenshot(page, testInfo, "settings-danger-unauthorized");
  });

  test("删除账号确认流程", async ({ page }, testInfo) => {
    await signInAsDebugUser(
      page,
      "/settings?tab=danger",
      "/settings?tab=danger",
    );

    await expectPagePath(page, "/settings?tab=danger");

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

    const input = page
      .getByRole("alertdialog")
      .last()
      .locator('input[placeholder="DELETE"]')
      .first();

    // Confirm button disabled until exact phrase typed
    const confirmButton = page
      .getByRole("alertdialog")
      .last()
      .getByRole("button", { name: /删除|Delete/i })
      .last();
    await expect(confirmButton).toBeDisabled();

    await input.fill("DEL");
    await expect(confirmButton).toBeDisabled();

    await input.fill("DELETE");
    await expect(confirmButton).toBeEnabled();
    await captureStepScreenshot(
      page,
      testInfo,
      "settings-danger-confirm-enabled",
    );

    // Cancel closes dialog without action
    await page.getByRole("button", { name: /取消|Cancel/i }).click();
    await expect(input).not.toBeVisible();
  });

  test("实际删除账号后退出登录并可重新登录", async ({ page }, testInfo) => {
    test.setTimeout(60_000);

    await signInAsDebugUser(
      page,
      "/settings?tab=danger",
      "/settings?tab=danger",
    );
    await expectPagePath(page, "/settings?tab=danger");

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

    // Submit deletion and wait for the server-side sign-out redirect
    await Promise.all([
      page.waitForURL(/\/(?:\?.*)?$/, { timeout: 15_000 }),
      confirmButton.click(),
    ]);

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
