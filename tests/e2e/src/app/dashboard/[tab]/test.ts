/**
 * E2E tests for dashboard route variants (`/dashboard/<tab>`).
 */
import { expect, test } from "@playwright/test";
import {
  expectRequiresSignIn,
  signInAsDebugUser,
} from "../../../../utils/auth";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";

test("/dashboard 别名需要登录", async ({ page }, testInfo) => {
  await expectRequiresSignIn(page, "/dashboard/homeworks");
  await captureStepScreenshot(page, testInfo, "dashboard-homeworks-unauth");
});

test("/dashboard/homeworks 加载登录标签", async ({ page }, testInfo) => {
  await signInAsDebugUser(page, "/dashboard/homeworks");
  await gotoAndWaitForReady(page, "/dashboard/homeworks", {
    testInfo,
    screenshotLabel: "dashboard-homeworks",
  });

  await expect(page).toHaveURL(/\/dashboard\/homeworks(?:[/?#].*)?$/);
  await expect(
    page.getByRole("link", { name: /作业|Homework/i }),
  ).toHaveAttribute("aria-current", "page");
  await captureStepScreenshot(page, testInfo, "dashboard-homeworks");
});
