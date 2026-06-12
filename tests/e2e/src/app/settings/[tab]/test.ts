/**
 * E2E tests for settings route variants (`/settings/<tab>`).
 */
import { expect, test } from "@playwright/test";
import {
  expectRequiresSignIn,
  signInAsDebugUser,
} from "../../../../utils/auth";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";

test("/settings aliases require authentication", async ({ page }, testInfo) => {
  await expectRequiresSignIn(page, "/settings/profile");
  await captureStepScreenshot(page, testInfo, "settings-profile-unauth");
});

test("/settings/profile alias is routed", async ({ page }, testInfo) => {
  await signInAsDebugUser(page, "/settings/profile");
  await gotoAndWaitForReady(page, "/settings/profile", {
    testInfo,
    screenshotLabel: "settings-profile-alias",
  });

  await expect(page).toHaveURL(/\/settings(?:\/profile)?(?:[/?#].*)?$/);
  await expect(page.locator("input#name")).toBeVisible();
  await captureStepScreenshot(page, testInfo, "settings-profile");
});
