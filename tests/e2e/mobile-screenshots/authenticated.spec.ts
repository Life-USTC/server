import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../fixtures/dev-seed";
import { mobileScreenshotPaths } from "../src/app/_shared/page-inventory";
import { signInAsDebugUser } from "../utils/auth";
import {
  getCurrentSessionUser,
  getUserProfileById,
  updateUserProfileById,
} from "../utils/e2e-db";
import { gotoAndWaitForReady } from "../utils/page-ready";
import { healthyMobileRoute } from "./route-health";

test.describe("移动端页面健全性", () => {
  test.describe("登录后页面", () => {
    test.beforeEach(async ({ page }) => {
      await signInAsDebugUser(page, "/");
    });

    for (const path of mobileScreenshotPaths("authed")) {
      healthyMobileRoute(path, path);
    }

    test(`/community/users/[identifier] ID 页面截图`, async ({ page }) => {
      const sessionResponse = await page.request.get("/api/auth/get-session");
      const session = (await sessionResponse.json()) as {
        user?: { id?: string };
      };
      const userId = session.user?.id ?? "";
      await gotoAndWaitForReady(page, `/community/users/${userId}`, {
        browserHealth: {},
        expectMeaningfulContent: true,
        expectNoHorizontalOverflow: true,
        uiQuality: {},
      });
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
          await gotoAndWaitForReady(page, "/account/welcome", {
            browserHealth: {},
            expectMeaningfulContent: true,
            expectNoHorizontalOverflow: true,
            uiQuality: {},
          });
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
});
