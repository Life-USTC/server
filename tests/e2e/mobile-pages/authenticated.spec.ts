import { expect } from "@playwright/test";
import { mobilePageCases } from "../src/app/_shared/page-inventory";
import { DEV_SEED, DEV_SEED_ANCHOR } from "../utils/dev-seed";
import { test } from "../utils/mobile-page-fixture";
import { gotoAndWaitForReady } from "../utils/page-ready";
import { expectHealthyMobileRoute } from "./route-health";

const tokenPages = [
  "/workspace/subscriptions",
  "/workspace/calendar",
  "/workspace/exams",
];
const memberPages = mobilePageCases("authed");

test.describe("移动端页面健全性", () => {
  test.describe("登录后页面", () => {
    // Each route consumes its own populated account and starts with a null token.
    for (const { path, domain } of memberPages) {
      test(path, { tag: `@${domain}/Web` }, async ({ page, mobileRun }) => {
        const calendarTokenCreated = tokenPages.includes(path);
        await mobileRun(
          async ({ startPage, checkpoint }) => {
            await startPage();
            const target = path.startsWith("/workspace/")
              ? `${path}?snapshotAt=${encodeURIComponent(DEV_SEED_ANCHOR.recommendedAtTime)}`
              : path;
            await expectHealthyMobileRoute(page, target);
            if (path === "/workspace/calendar") {
              await expect(
                page
                  .getByTestId("calendar-agenda")
                  .filter({ visible: true })
                  .locator(
                    `a[href="/catalog/sections/${DEV_SEED.section.jwId}"]`,
                  )
                  .first(),
              ).toBeVisible();
            }
            await checkpoint(path, {
              calendarMessages: [],
              calendarTokenCreated,
            });
          },
          { calendarTokenCreated },
        );
      });
    }

    test("member profile ID resolves its private session", {
      tag: "@Site/Web",
    }, async ({ page, mobileAccount, mobileRun }) => {
      await mobileRun(
        async ({ headers, startPage, checkpoint }) => {
          await startPage();
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
          await checkpoint("/community/users/[identifier] ID", {
            calendarMessages: [],
            calendarTokenCreated: false,
          });
        },
        { calendarTokenCreated: false },
      );
    });

    test.describe("welcome 独立用户状态", () => {
      test.use({ incompleteMobileProfile: true });

      test("/account/welcome 页面健全性", { tag: "@Account/Web" }, async ({
        page,
        mobileRun,
      }) => {
        await mobileRun(
          async ({ startPage, checkpoint }) => {
            await startPage();
            await gotoAndWaitForReady(page, "/account/welcome", {
              browserHealth: {},
              expectMeaningfulContent: true,
              expectNoHorizontalOverflow: true,
              uiQuality: {},
            });
            await expect(page).toHaveURL(/\/account\/welcome(?:\?.*)?$/);
            await expect(
              page.getByRole("textbox", {
                name: /^(昵称|Nickname)(?:\s|$)/i,
              }),
            ).toBeVisible();
            await checkpoint("/account/welcome 页面健全性", {
              calendarMessages: [],
              calendarTokenCreated: false,
            });
          },
          { calendarTokenCreated: false },
        );
      });
    });
  });
});
