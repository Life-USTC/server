import { expect } from "@playwright/test";
import { test } from "../../../../utils/account-fixture";
import { expectRequiresSignIn } from "../../../../utils/auth";
import { observeAction } from "../../../../utils/observed-action";
import {
  expectNoPageHorizontalOverflow,
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { expectSettingsPage } from "../../../../utils/settings-fixture";

test.describe.configure({ mode: "parallel" });

test.describe("/account/settings/preferences 外观与语言偏好", () => {
  test("canonical 路径需要登录", async ({ page }, testInfo) => {
    await expectRequiresSignIn(page, "/account/settings/preferences");
    await captureStepScreenshot(
      page,
      testInfo,
      "settings-preferences-unauthorized",
    );
  });

  test("legacy query 输入规范到语义路径", async ({
    run,
    accountRun,
    page,
    isolatedWorker,
  }) => {
    await run(async () => {
      const actor = await isolatedWorker.createActor();
      await page.context().addCookies([actor.cookie]);
    });
    await accountRun({ writes: [], audits: [] }, async () => {
      await gotoAndWaitForReady(page, "/account/settings/preferences");

      const response = await page.request.get(
        "/account/settings?tab=preferences",
        {
          maxRedirects: 0,
        },
      );

      expect(response.status()).toBe(308);
      expect(response.headers().location).toBe("/account/settings/preferences");
    });
  });

  test("外观选择立即应用并写入既有 localStorage", async ({
    run,
    accountRun,
    page,
    isolatedWorker,
  }, testInfo) => {
    await run(async () => {
      const actor = await isolatedWorker.createActor();
      await page.context().addCookies([actor.cookie]);
    });
    await accountRun({ writes: [], audits: [] }, async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await gotoAndWaitForReady(page, "/account/settings/preferences");

      const preferences = page.getByRole("region", {
        name: /偏好设置|Preferences/i,
      });
      const dark = preferences.getByRole("radio", {
        name: /^(深色|Dark)$/i,
      });

      for (const control of await preferences.getByRole("radio").all()) {
        const box = await control.boundingBox();
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      }

      await dark.click();

      await expect(dark).toBeChecked();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await expect
        .poll(() =>
          page.evaluate(() => localStorage.getItem("life-ustc-theme")),
        )
        .toBe("dark");
      await expectNoPageHorizontalOverflow(page);

      await page.emulateMedia({ colorScheme: "dark" });
      await preferences
        .getByRole("radio", { name: /^(跟随系统|System)$/i })
        .click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await page.emulateMedia({ colorScheme: "light" });
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      await captureStepScreenshot(
        page,
        testInfo,
        "settings-preferences-mobile",
      );
    });
  });

  test("语言选择复用 locale API 且 URL 不增加语言目录", async ({
    run,
    accountRun,
    page,
    isolatedWorker,
  }, testInfo) => {
    await run(async () => {
      const actor = await isolatedWorker.createActor();
      await page
        .context()
        .addCookies([
          actor.cookie,
          { name: "NEXT_LOCALE", value: "zh-cn", url: isolatedWorker.origin },
        ]);
    });
    await accountRun(
      { writes: [["/api/account/preferences", 200]], audits: [] },
      async () => {
        await gotoAndWaitForReady(page, "/account/settings/preferences");

        const localeResponse = await observeAction(
          () =>
            page.waitForResponse(
              (response) =>
                response.url().endsWith("/api/account/preferences") &&
                response.request().method() === "POST",
            ),
          () =>
            page
              .getByRole("region", { name: /偏好设置|Preferences/i })
              .getByRole("radio", { name: /^English$/i })
              .click(),
        );
        expect(localeResponse.status()).toBe(200);

        await expect(page).toHaveURL(/\/account\/settings\/preferences$/);
        await expect(page).not.toHaveURL(/\/(?:zh-cn|en-us)\//);
        await expect(
          page.getByRole("region", { name: "Preferences" }),
        ).toBeVisible();
        expect(
          (await page.context().cookies()).find(
            (cookie) => cookie.name === "NEXT_LOCALE",
          )?.value,
        ).toBe("en-us");
        await waitForUiSettled(page);
        await page.reload();
        await expect(page.locator("html")).toHaveAttribute("lang", "en-us");
        await captureStepScreenshot(
          page,
          testInfo,
          "settings-preferences-english",
        );
      },
    );
  });
});

test("页面契约", async ({
  run,
  accountRun,
  page,
  isolatedWorker,
}, testInfo) => {
  await run(async () => {
    const actor = await isolatedWorker.createActor();
    await page.context().addCookies([actor.cookie]);
  });
  await accountRun({ writes: [], audits: [] }, async () => {
    await expectSettingsPage(page, "/account/settings/preferences", testInfo);
    await expect(page.getByText(/外观|Appearance/i).first()).toBeVisible();
  });
});
