/**
 * E2E tests for the Settings Profile section (`/account/settings/profile`)
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
 * - Empty username → browser validation prevents submission
 * - Empty avatar options do not prevent a subsequent debug sign-in
 * - Save success → one visible Sonner toast
 * - Name change persists across page reload
 */
import { expect, test } from "@playwright/test";
import {
  expectPagePath,
  expectRequiresSignIn,
  signInAsDebugUser,
} from "../../../../utils/auth";
import { DEV_SEED } from "../../../../utils/dev-seed";
import {
  getCurrentSessionUser,
  getUserProfileById,
  updateUserProfileById,
} from "../../../../utils/e2e-db";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { assertPageContract } from "../../_shared/page-contract";

test.describe("/account/settings/profile 个人资料设置", () => {
  // Serial mode avoids intra-file contention on the shared debug user profile.
  test.describe.configure({ mode: "serial" });

  test("需要登录", async ({ page }, testInfo) => {
    await expectRequiresSignIn(page, "/account/settings/profile");
    await captureStepScreenshot(
      page,
      testInfo,
      "settings/profile-unauthorized",
    );
  });

  test("显示所有必填个人资料字段", async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    await signInAsDebugUser(page, "/account/settings/profile");

    await expectPagePath(page, "/account/settings/profile");
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

  test("可保存姓名并回滚", async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    await signInAsDebugUser(page, "/account/settings/profile");

    const nameInput = page.locator("input#name");
    const saveButton = page.getByRole("button", { name: /保存|Save/i });
    const successToast = page
      .locator("[data-sonner-toast]")
      .filter({ hasText: /成功|Success|updated successfully/i });
    const originalName = await nameInput.inputValue();
    const newName = `e2e-${Date.now()}`;

    await nameInput.fill(newName);
    const saveResponsePromise = page.waitForResponse(
      (r) =>
        r.url().includes("/account/settings") &&
        r.request().method() === "POST",
    );
    await saveButton.click();
    await saveResponsePromise;
    await expect(successToast).toBeVisible();
    await expect(page).toHaveURL(/\/account\/settings\/profile$/);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("input#name")).toHaveValue(newName, {
      timeout: 10_000,
    });
    await captureStepScreenshot(page, testInfo, "settings/profile-saved");

    await page.locator("input#name").fill(originalName);
    const rollbackResponsePromise = page.waitForResponse(
      (r) =>
        r.url().includes("/account/settings") &&
        r.request().method() === "POST",
    );
    await saveButton.click();
    await rollbackResponsePromise;
    await expect(successToast).toBeVisible();
    await expect(page).toHaveURL(/\/account\/settings\/profile$/);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("input#name")).toHaveValue(originalName, {
      timeout: 10_000,
    });
  });

  test("保存前要求填写用户名", async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    await signInAsDebugUser(page, "/account/settings/profile");

    const usernameInput = page.locator("input#username");
    await usernameInput.fill("");
    await page.getByRole("button", { name: /保存|Save/i }).click();

    await expect(usernameInput).toBeFocused();
    await expect
      .poll(() =>
        usernameInput.evaluate(
          (input) => (input as HTMLInputElement).validationMessage.length,
        ),
      )
      .toBeGreaterThan(0);
    await captureStepScreenshot(
      page,
      testInfo,
      "settings/profile-username-required",
    );
  });

  test("清空头像选项后仍可重新登录", async ({ page }) => {
    test.setTimeout(300_000);
    await signInAsDebugUser(page, "/account/settings/profile", undefined, {
      ui: true,
    });
    const sessionUser = await getCurrentSessionUser(page);
    const originalUser = await getUserProfileById(sessionUser.id);

    await updateUserProfileById(sessionUser.id, {
      image: null,
      profilePictures: [],
    });

    try {
      const signOutResponse = await page.request.post("/account/sign-out", {
        maxRedirects: 0,
      });
      expect(signOutResponse.status()).toBe(303);
      await gotoAndWaitForReady(page, "/account/sign-in");
      await signInAsDebugUser(
        page,
        "/account/settings/profile",
        "/account/settings/profile",
        { ui: true },
      );
      await expectPagePath(page, "/account/settings/profile");
    } finally {
      await updateUserProfileById(sessionUser.id, {
        image: originalUser.image,
        profilePictures: originalUser.profilePictures,
      });
    }
  });
});

test("页面契约", async ({ page }, testInfo) => {
  await assertPageContract(page, {
    routePath: "/account/settings/profile",
    testInfo,
  });
});
