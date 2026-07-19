/**
 * E2E tests for the Settings Content section (`/settings/content`)
 *
 * ## Data Represented
 * - `/settings/content` is the canonical content settings entry.
 * - Content section explains that uploads/comments are object-scoped, not
 *   standalone settings pages.
 * - It provides next-step links to section browsing and the comment guide.
 *
 * ## UI/UX Elements
 * - Informational empty state about content management
 * - `PageLinkGrid` with cards for sections and comment guide
 *
 * ## Edge Cases
 * - Unauthenticated → redirects to /signin
 */
import { expect, test } from "@playwright/test";
import {
  expectPagePath,
  expectRequiresSignIn,
  signInAsDebugUser,
} from "../../../../utils/auth";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";

test.describe("/settings/content 内容设置", () => {
  test("需要登录", async ({ page }, testInfo) => {
    await expectRequiresSignIn(page, "/settings/content");
    await captureStepScreenshot(
      page,
      testInfo,
      "settings-content-unauthorized",
    );
  });

  test("显示标准内容引导", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/settings/content");

    await expectPagePath(page, "/settings/content");
    await expect(
      page.getByText(
        /内容会跟随课程、班级、作业等对象管理|Manage uploads and comments from the course, section, or homework where they belong/i,
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /浏览班级|Browse sections/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /评论指南|Comment guide/i }),
    ).toBeVisible();
    await captureStepScreenshot(page, testInfo, "settings-content-links");
  });

  test("内容链接导航正确", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/settings/content");

    const sectionsLink = page.getByRole("link", {
      name: /浏览班级|Browse sections/i,
    });
    await sectionsLink.click();
    await expect(page).toHaveURL(/\/sections(?:\?.*)?$/);
    await captureStepScreenshot(
      page,
      testInfo,
      "settings-content-navigate-sections",
    );

    await gotoAndWaitForReady(page, "/settings/content", {
      testInfo,
      screenshotLabel: "settings-content",
    });
    const guideLink = page.getByRole("link", {
      name: /评论指南|Comment guide/i,
    });
    await guideLink.click();
    await expect(page).toHaveURL(/\/guides\/markdown-support(?:\?.*)?$/);
    await captureStepScreenshot(
      page,
      testInfo,
      "settings-content-navigate-guide",
    );
  });
});
