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
 * - We do NOT actually delete the account in tests (only verify UI flow)
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
      const dialog = page.getByRole("dialog").last();
      await expect(dialog).toBeVisible();
      await expect(
        dialog.locator('input[placeholder="DELETE"]').first(),
      ).toBeVisible();
    }).toPass({
      timeout: 10_000,
      intervals: [250, 500, 1_000],
    });

    const input = page
      .getByRole("dialog")
      .last()
      .locator('input[placeholder="DELETE"]')
      .first();

    // Confirm button disabled until exact phrase typed
    const confirmButton = page
      .getByRole("dialog")
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
});
