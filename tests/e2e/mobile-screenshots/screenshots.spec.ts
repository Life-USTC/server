import { test } from "@playwright/test";
import { DEV_SEED } from "../../fixtures/dev-seed";
import { signInAsDebugUser, signInAsDevAdmin } from "../utils/auth";
import { gotoAndWaitForReady } from "../utils/page-ready";

function screenshotRoute(name: string, path: string) {
  test(name, async ({ page }) => {
    await gotoAndWaitForReady(page, path);
  });
}

test.describe("移动端截图", () => {
  test.describe("公开页面", () => {
    for (const path of [
      "/",
      "/courses",
      `/courses/${DEV_SEED.course.jwId}`,
      "/sections",
      `/sections/${DEV_SEED.section.jwId}`,
      "/teachers",
      "/bus-map",
      "/welcome",
      "/comments/guide",
      "/guides/markdown-support",
      "/privacy",
      "/terms",
      "/mobile-app",
      "/signin",
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
      "/dashboard",
      "/dashboard?tab=homeworks",
      "/dashboard?tab=todos",
      "/dashboard?tab=calendar",
      "/dashboard?tab=exams",
      "/dashboard?tab=links",
      "/dashboard?tab=subscriptions",
      "/settings?tab=profile",
      "/settings?tab=accounts",
      "/settings?tab=content",
      "/settings?tab=danger",
      `/u/${DEV_SEED.debugUsername}`,
    ]) {
      screenshotRoute(path, path);
    }

    test(`/u/id/[uid] 页面截图`, async ({ page }) => {
      const sessionResponse = await page.request.get("/api/auth/get-session");
      const session = (await sessionResponse.json()) as {
        user?: { id?: string };
      };
      const userId = session.user?.id ?? "";
      await gotoAndWaitForReady(page, `/u/id/${userId}`);
    });
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
