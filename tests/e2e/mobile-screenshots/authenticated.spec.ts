import { expect } from "@playwright/test";
import { mobileScreenshotPaths } from "../src/app/_shared/page-inventory";
import { expectHealthyMobileRoute, test } from "../utils/mobile-page-fixture";
import { gotoAndWaitForReady } from "../utils/page-ready";

test.describe("移动端页面健全性", () => {
  test.describe("登录后页面", () => {
    for (const path of mobileScreenshotPaths("authed")) {
      test(path, async ({ page, mobileRun }) => {
        await mobileRun(async () => expectHealthyMobileRoute(page, path), {
          calendarTokenCreated: [
            "/workspace/subscriptions",
            "/workspace/calendar",
            "/workspace/exams",
          ].includes(path),
        });
      });
    }

    test(`/community/users/[identifier] ID 页面截图`, async ({
      page,
      mobileAccount,
      mobileRun,
    }) => {
      await mobileRun(
        async ({ headers }) => {
          const sessionResponse = await page.request.get(
            "/api/auth/get-session",
            { headers },
          );
          expect(sessionResponse.status()).toBe(200);
          const session = (await sessionResponse.json()) as {
            user?: { id?: string };
          };
          const userId = session.user?.id ?? "";
          expect(userId).toBe(mobileAccount.id);
          await gotoAndWaitForReady(page, `/community/users/${userId}`, {
            browserHealth: {},
            expectMeaningfulContent: true,
            expectNoHorizontalOverflow: true,
            uiQuality: {},
          });
        },
        { calendarTokenCreated: false },
      );
    });

    // Retain the original test identity; state now belongs to this case alone.
    test.describe("welcome 共享用户状态", () => {
      test.use({ incompleteMobileProfile: true });

      test("/account/welcome 页面截图", async ({ page, mobileRun }) => {
        await mobileRun(
          async () => {
            await gotoAndWaitForReady(page, "/account/welcome", {
              browserHealth: {},
              expectMeaningfulContent: true,
              expectNoHorizontalOverflow: true,
              uiQuality: {},
            });
            await expect(page).toHaveURL(/\/account\/welcome(?:\?.*)?$/);
            await expect(
              page.getByRole("textbox", { name: /^(昵称|Nickname)(?:\s|$)/i }),
            ).toBeVisible();
          },
          { calendarTokenCreated: false },
        );
      });
    });
  });
});
