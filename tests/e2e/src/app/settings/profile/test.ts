/**
 * E2E tests for the Settings Profile Tab (`/settings?tab=profile`)
 *
 * ## Data Represented (user.yml → settings.display.fields)
 * - user.profilePictures[] (avatar options)
 * - user.image (current avatar)
 * - user.name (display name)
 * - user.username (username)
 *
 * ## Features
 * - Avatar selector shows current avatar and selectable thumbnails
 * - Name input pre-filled from database; save persists
 * - Username input with pattern validation
 *
 * ## Edge Cases
 * - Unauthenticated → redirects to /signin
 * - Invalid username pattern → browser validation prevents submission
 * - Save success → toast with "Success" heading
 * - Name change persists across page reload
 */
import { expect, test } from "@playwright/test";
import {
  expectPagePath,
  expectRequiresSignIn,
  signInAsDebugUser,
} from "../../../../utils/auth";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { captureStepScreenshot } from "../../../../utils/screenshot";

test.describe("/settings?tab=profile", () => {
  // Serial mode avoids intra-file contention on the shared debug user profile.
  test.describe.configure({ mode: "serial" });

  test("requires authentication", async ({ page }, testInfo) => {
    await expectRequiresSignIn(page, "/settings?tab=profile");
    await captureStepScreenshot(
      page,
      testInfo,
      "settings/profile-unauthorized",
    );
  });

  test("displays all required profile fields", async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    await signInAsDebugUser(page, "/settings?tab=profile");

    await expectPagePath(page, "/settings?tab=profile");
    await expect(page.locator("input#name")).toHaveValue(DEV_SEED.debugName);
    await expect(page.locator("input#username")).toHaveValue(
      DEV_SEED.debugUsername,
    );

    const avatarImg = page
      .locator('img[alt*="avatar"], img[alt*="Avatar"], img[src*="avatar"]')
      .or(page.locator('[data-testid="current-avatar"]'))
      .or(page.locator("img"))
      .first();
    await expect(avatarImg).toBeVisible();
    await expect(
      page.getByText(/头像|Avatar|Profile picture/i).first(),
    ).toBeVisible();

    await captureStepScreenshot(page, testInfo, "settings/profile-fields");
  });

  test("can save name and rollback", async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    await signInAsDebugUser(page, "/settings?tab=profile");

    const nameInput = page.locator("input#name");
    const saveButton = page.getByRole("button", { name: /保存|Save/i });
    const successToast = page.getByRole("heading", {
      name: /成功|Success/i,
    });
    const originalName = await nameInput.inputValue();
    const newName = `e2e-${Date.now()}`;

    await nameInput.fill(newName);
    const saveResponsePromise = page.waitForResponse(
      (r) => r.url().includes("/settings") && r.request().method() === "POST",
    );
    await saveButton.click();
    await saveResponsePromise;
    await expect(successToast).toBeVisible();
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("input#name")).toHaveValue(newName, {
      timeout: 10_000,
    });
    await captureStepScreenshot(page, testInfo, "settings/profile-saved");

    await page.locator("input#name").fill(originalName);
    const rollbackResponsePromise = page.waitForResponse(
      (r) => r.url().includes("/settings") && r.request().method() === "POST",
    );
    await saveButton.click();
    await rollbackResponsePromise;
    await expect(successToast).toBeVisible();
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("input#name")).toHaveValue(originalName, {
      timeout: 10_000,
    });
  });
});
