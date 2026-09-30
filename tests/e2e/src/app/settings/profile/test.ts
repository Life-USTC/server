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
import { expect } from "@playwright/test";
import { expectPagePath, expectRequiresSignIn } from "../../../../utils/auth";
import { observeAction } from "../../../../utils/observed-action";

import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { absoluteTestUrl } from "../../../../utils/request-url";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import {
  expectSettingsPage,
  storedProfile,
  test,
} from "../../../../utils/settings-fixture";

test.describe("/account/settings/profile 个人资料设置", () => {
  test.describe.configure({ mode: "parallel" });

  test("需要登录", async ({ accountRun, page }, testInfo) => {
    await accountRun({ writes: [], audits: [] }, async () => {
      await expectRequiresSignIn(page, "/account/settings/profile");
      await captureStepScreenshot(
        page,
        testInfo,
        "settings/profile-unauthorized",
      );
    });
  });

  test("显示所有必填个人资料字段", async ({
    accountRun,
    page,
    profile: account,
  }, testInfo) => {
    await accountRun({ writes: [], audits: [] }, async () => {
      await gotoAndWaitForReady(page, "/account/settings/profile");

      await expectPagePath(page, "/account/settings/profile");
      await expect(page.locator("input#name")).toHaveValue(account.name);
      await expect(page.locator("input#username")).toHaveValue(
        account.username ?? "",
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
  });

  test("可保存姓名并回滚", async ({
    accountRun,
    page,
    account,
    isolatedWorker,
  }, testInfo) => {
    await accountRun(
      {
        writes: [
          [
            "/account/settings/profile",
            200,
            "updateProfile",
            "/account/settings/profile?message=Success",
          ],
          [
            "/account/settings/profile",
            200,
            "updateProfile",
            "/account/settings/profile?message=Success",
          ],
        ],
        audits: ["account_profile_update", "account_profile_update"],
      },
      async () => {
        await gotoAndWaitForReady(page, "/account/settings/profile");

        const nameInput = page.locator("input#name");
        const saveButton = page.getByRole("button", { name: /保存|Save/i });
        const successToast = page
          .locator("[data-sonner-toast]")
          .filter({ hasText: /成功|Success|updated successfully/i });
        const originalName = account.name;
        const newName = "Updated private profile";

        await nameInput.fill(newName);
        const saveResponse = await observeAction(
          () =>
            page.waitForResponse(
              (r) =>
                r.url().includes("/account/settings") &&
                r.request().method() === "POST",
            ),
          () => saveButton.click(),
        );
        await saveResponse.body();
        await expect(successToast).toBeVisible();
        expect(
          await storedProfile(isolatedWorker.database.owner, account.id),
        ).toMatchObject({ name: newName });
        await expect(page).toHaveURL(/\/account\/settings\/profile$/);
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.locator("input#name")).toHaveValue(newName, {
          timeout: 10_000,
        });
        await captureStepScreenshot(page, testInfo, "settings/profile-saved");

        await page.locator("input#name").fill(originalName);
        const rollbackResponse = await observeAction(
          () =>
            page.waitForResponse(
              (r) =>
                r.url().includes("/account/settings") &&
                r.request().method() === "POST",
            ),
          () => saveButton.click(),
        );
        await rollbackResponse.body();
        await expect(successToast).toBeVisible();
        expect(
          await storedProfile(isolatedWorker.database.owner, account.id),
        ).toMatchObject({
          name: originalName,
        });
        await expect(page).toHaveURL(/\/account\/settings\/profile$/);
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.locator("input#name")).toHaveValue(originalName, {
          timeout: 10_000,
        });
        return async () => {
          expect(
            await storedProfile(isolatedWorker.database.owner, account.id),
          ).toMatchObject({ name: originalName, username: account.username });
        };
      },
    );
  });

  test("保存前要求填写用户名", async ({
    accountRun,
    page,
    account,
    isolatedWorker,
  }, testInfo) => {
    await accountRun({ writes: [], audits: [] }, async () => {
      await gotoAndWaitForReady(page, "/account/settings/profile");

      const usernameInput = page.locator("input#username");
      await usernameInput.fill("");
      await page.getByRole("button", { name: /保存|Save/i }).click();

      await expect(usernameInput).toBeFocused();
      expect(
        await storedProfile(isolatedWorker.database.owner, account.id),
      ).toMatchObject({
        name: account.name,
        username: account.username,
      });
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
  });

  test("清空头像选项后仍可重新登录", async ({
    accountRun,
    page,
    profile: account,
    credential,
    baseURL,
    isolatedWorker,
  }) => {
    await accountRun(
      {
        writes: [
          ["/account/sign-out", 303],
          ["/api/auth/sign-in/email", 200],
        ],
        audits: ["account_sign_out", "account_sign_in"],
      },
      async () => {
        await isolatedWorker.database.owner.user.update({
          where: { id: account.id },
          data: { image: null, profilePictures: [] },
        });
        const signOut = await page.request.post("/account/sign-out", {
          maxRedirects: 0,
        });
        expect(signOut.status()).toBe(303);
        await gotoAndWaitForReady(page, "/account/sign-in");
        const signedIn = await page.request.post("/api/auth/sign-in/email", {
          data: credential,
          headers: { origin: absoluteTestUrl("/", baseURL).replace(/\/$/, "") },
        });
        expect(signedIn.status()).toBe(200);
        expect((await signedIn.json()).user.id).toBe(account.id);
        await gotoAndWaitForReady(page, "/account/settings/profile");
        await expectPagePath(page, "/account/settings/profile");
        expect(
          await storedProfile(isolatedWorker.database.owner, account.id),
        ).toMatchObject({
          image: null,
          profilePictures: [],
        });
        return async () => {
          expect(
            await storedProfile(isolatedWorker.database.owner, account.id),
          ).toMatchObject({ image: null, profilePictures: [] });
        };
      },
    );
  });
});

test("页面契约", async ({ accountRun, page, account: _account }, testInfo) => {
  await accountRun({ writes: [], audits: [] }, async () => {
    await expectSettingsPage(page, "/account/settings/profile", testInfo);
    await expect(
      page.getByRole("heading", { name: /编辑个人资料|Edit Profile/i }),
    ).toBeVisible();
  });
});
