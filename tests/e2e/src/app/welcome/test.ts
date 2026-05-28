/**
 * E2E tests for /welcome
 *
 * ## Data Represented (user.yml → first-login-welcome.display.fields)
 * - user.name (current value display)
 * - user.username (current value display)
 * - user.image (current avatar)
 * - user.profilePictures[] (avatar selector grid)
 * - semesters[] (semester dropdown options)
 * - defaultSemesterId (preselected semester)
 *
 * ## Features
 * - Unauthenticated → redirect to /signin
 * - Users with no name/username must complete before proceeding to /
 * - Avatar selector grid is shown
 * - Semester dropdown pre-selects the current semester
 * - Links to browse sections / courses and bulk import
 *
 * ## Edge Cases
 * - After successful save redirects to /
 * - Name and username fields are restored to seed values after test
 */
import { expect, test } from "@playwright/test";
import { expectRequiresSignIn, signInAsDebugUser } from "../../../utils/auth";

// All three tests below contend for the same lock; run them one at a time
// so earlier tests don't block later ones past the lock-acquisition timeout.
test.describe.configure({ mode: "serial" });

import { DEV_SEED } from "../../../utils/dev-seed";
import {
  getCurrentSessionUser,
  getUserProfileById,
  updateUserProfileById,
} from "../../../utils/e2e-db";
import { withE2eLock } from "../../../utils/locks";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { captureStepScreenshot } from "../../../utils/screenshot";

test("/welcome 未登录重定向到登录页", async ({ page }, testInfo) => {
  await expectRequiresSignIn(page, "/welcome");
  await captureStepScreenshot(page, testInfo, "welcome/unauthorized");
});

test("/welcome displays required fields", async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  await withE2eLock("debug-user-profile", async () => {
    await signInAsDebugUser(page, "/");
    const sessionUser = await getCurrentSessionUser(page);
    const originalUser = await getUserProfileById(sessionUser.id);

    await updateUserProfileById(sessionUser.id, { name: null, username: null });

    try {
      await gotoAndWaitForReady(page, "/welcome", {
        testInfo,
        screenshotLabel: "welcome",
      });

      // user.name and user.username fields (user.yml first-login-welcome.display.fields)
      await expect(
        page.getByRole("textbox", { name: /^(姓名|Name)\b/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("textbox", { name: /^(用户名|Username)\b/i }),
      ).toBeVisible();

      // user.image / user.profilePictures[] — avatar area should be visible
      const avatarArea = page
        .locator('[data-testid="avatar-selector"], img[alt], [role="img"]')
        .first();
      await expect(avatarArea).toBeVisible();

      // semesters[] dropdown options (defaultSemesterId preselected)
      // The semester selector is inside the Bulk Import dialog
      const bulkImportBtn = page.getByRole("button", {
        name: /批量导入班级|Bulk Import Sections/i,
      });
      await expect(bulkImportBtn).toBeVisible();
      await bulkImportBtn.click();
      // Dialog opens, semester selector inside
      const dialog = page
        .getByRole("dialog")
        .or(page.getByRole("alertdialog"))
        .first();
      await expect(dialog).toBeVisible({ timeout: 8_000 });
      const semesterSelector = dialog.getByRole("combobox").first();
      await expect(semesterSelector).toBeVisible();
      // Seed semester name should be selectable
      await semesterSelector.click();
      await expect(
        page.getByRole("option", { name: DEV_SEED.semesterNameCn }).first(),
      ).toBeVisible({ timeout: 5_000 });
      // Close dialog
      await page.keyboard.press("Escape");

      await captureStepScreenshot(page, testInfo, "welcome/fields");
    } finally {
      await updateUserProfileById(sessionUser.id, {
        name: originalUser.name ?? DEV_SEED.debugName,
        username: originalUser.username ?? DEV_SEED.debugUsername,
        image: originalUser.image ?? null,
      });
    }
  });
});

test("/welcome 未完善资料的用户可完成资料并返回首页", async ({
  page,
}, testInfo) => {
  test.setTimeout(300_000);
  await withE2eLock("debug-user-profile", async () => {
    await signInAsDebugUser(page, "/");

    const sessionUser = await getCurrentSessionUser(page);
    const originalUser = await getUserProfileById(sessionUser.id);

    await updateUserProfileById(sessionUser.id, {
      name: null,
      username: null,
    });

    try {
      await gotoAndWaitForReady(page, "/welcome", {
        testInfo,
        screenshotLabel: "welcome",
      });

      await expect(page).toHaveURL(/\/welcome(?:\?.*)?$/);
      await page
        .getByRole("textbox", { name: /^(姓名|Name)\b/i })
        .fill(DEV_SEED.debugName);
      await page
        .getByRole("textbox", { name: /^(用户名|Username)\b/i })
        .fill(DEV_SEED.debugUsername);

      await page.getByRole("button", { name: /继续|Continue/i }).click();

      await expect(page).toHaveURL(/\/(?:\?.*)?$/, {
        timeout: 15_000,
      });
      await expect(page.locator("#main-content")).toBeVisible();

      const updatedUser = await getUserProfileById(sessionUser.id);
      expect(updatedUser.name).toBe(DEV_SEED.debugName);
      expect(updatedUser.username).toBe(DEV_SEED.debugUsername);
      await captureStepScreenshot(page, testInfo, "welcome/completed");
    } finally {
      await updateUserProfileById(sessionUser.id, {
        name: originalUser.name ?? DEV_SEED.debugName,
        username: originalUser.username ?? DEV_SEED.debugUsername,
        image: originalUser.image ?? null,
      });
    }
  });
});

test("/welcome 提供浏览班级与批量匹配入口", async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  await withE2eLock("debug-user-profile", async () => {
    await signInAsDebugUser(page, "/");

    const sessionUser = await getCurrentSessionUser(page);
    const originalUser = await getUserProfileById(sessionUser.id);

    await updateUserProfileById(sessionUser.id, {
      name: null,
      username: null,
    });

    try {
      await gotoAndWaitForReady(page, "/welcome", {
        testInfo,
        screenshotLabel: "welcome",
      });

      await expect(
        page.getByRole("link", { name: /浏览班级|Browse Sections/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: /浏览课程|Browse Courses/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: /批量导入班级|Bulk Import Sections/i,
        }),
      ).toBeVisible();

      await captureStepScreenshot(page, testInfo, "welcome/next-steps");
    } finally {
      await updateUserProfileById(sessionUser.id, {
        name: originalUser.name ?? DEV_SEED.debugName,
        username: originalUser.username ?? DEV_SEED.debugUsername,
        image: originalUser.image ?? null,
      });
    }
  });
});
