import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../fixtures/dev-seed";
import { signInAsDebugUser, signInAsDevAdmin } from "../utils/auth";
import {
  getCurrentSessionUser,
  getUserProfileById,
  updateUserProfileById,
} from "../utils/e2e-db";
import { gotoAndWaitForReady } from "../utils/page-ready";
import {
  captureStepScreenshot,
  isStepScreenshotCaptureEnabled,
} from "../utils/screenshot";

function screenshotRoute(name: string, path: string) {
  test(name, async ({ page }) => {
    await gotoAndWaitForReady(page, path);
  });
}

test.describe("移动端截图", () => {
  test.describe("公开页面", () => {
    for (const path of [
      "/",
      "/catalog/courses",
      `/catalog/courses/${DEV_SEED.course.jwId}`,
      "/catalog/sections",
      `/catalog/sections/${DEV_SEED.section.jwId}`,
      "/catalog/teachers",
      "/catalog/bus/map",
      "/community/comments/guide",
      "/guides/markdown-support",
      "/privacy",
      "/terms",
      "/mobile-app",
      "/account/sign-in",
      "/oauth/device",
    ]) {
      screenshotRoute(path, path);
    }
  });

  test.describe("登录后页面", () => {
    test.beforeEach(async ({ page }) => {
      await signInAsDebugUser(page, "/");
    });

    for (const path of [
      "/workspace/overview",
      "/workspace/homeworks",
      "/workspace/todos",
      "/workspace/calendar",
      "/workspace/exams",
      "/workspace/links",
      "/workspace/subscriptions",
      "/account/settings/profile",
      "/account/settings/accounts",
      "/account/settings/content",
      "/account/settings/danger",
      `/community/users/${DEV_SEED.debugUsername}`,
    ]) {
      screenshotRoute(path, path);
    }

    test(`/community/users/id/[uid] 页面截图`, async ({ page }) => {
      const sessionResponse = await page.request.get("/api/auth/get-session");
      const session = (await sessionResponse.json()) as {
        user?: { id?: string };
      };
      const userId = session.user?.id ?? "";
      await gotoAndWaitForReady(page, `/community/users/id/${userId}`);
    });

    test.describe("welcome 共享用户状态", () => {
      test.describe.configure({ mode: "serial" });

      test("/account/welcome 页面截图", async ({ page }) => {
        const sessionUser = await getCurrentSessionUser(page);
        const originalUser = await getUserProfileById(sessionUser.id);
        await updateUserProfileById(sessionUser.id, {
          name: null,
          username: null,
        });

        try {
          await gotoAndWaitForReady(page, "/account/welcome");
          await expect(page).toHaveURL(/\/account\/welcome(?:\?.*)?$/);
          await expect(
            page.getByRole("textbox", { name: /^(姓名|Name)\b/i }),
          ).toBeVisible();
        } finally {
          await updateUserProfileById(sessionUser.id, {
            name: originalUser.name ?? DEV_SEED.debugName,
            username: originalUser.username ?? DEV_SEED.debugUsername,
            image: originalUser.image ?? null,
          });
        }
      });
    });
  });

  test("命名步骤截图会写入报告附件", async ({ page }, testInfo) => {
    test.skip(
      !isStepScreenshotCaptureEnabled(),
      "Set CAPTURE_STEP_SCREENSHOTS=1 for visual evidence runs.",
    );

    await gotoAndWaitForReady(page, "/");
    const attachmentName = "evidence/named-checkpoint";
    await captureStepScreenshot(page, testInfo, attachmentName);

    const attachment = testInfo.attachments.find(
      (candidate) => candidate.name === attachmentName,
    );
    expect(attachment?.contentType).toBe("image/jpeg");
    expect(attachment?.body?.byteLength).toBeGreaterThan(0);
  });

  test.describe("管理员页面", () => {
    test.beforeEach(async ({ page }) => {
      await signInAsDevAdmin(page, "/admin");
    });

    for (const path of [
      "/admin",
      "/admin/users",
      "/admin/moderation",
      "/admin/oauth",
      "/admin/bus",
    ]) {
      screenshotRoute(path, path);
    }
  });
});
