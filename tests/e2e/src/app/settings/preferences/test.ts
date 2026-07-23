import { expect, test } from "@playwright/test";
import {
  expectRequiresSignIn,
  signInAsDebugUser,
} from "../../../../utils/auth";
import { expectNoPageHorizontalOverflow } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";

test.describe("/account/settings/preferences 外观与语言偏好", () => {
  test("canonical 路径需要登录", async ({ page }, testInfo) => {
    await expectRequiresSignIn(page, "/account/settings/preferences");
    await captureStepScreenshot(
      page,
      testInfo,
      "settings-preferences-unauthorized",
    );
  });

  test("legacy query 输入规范到语义路径", async ({ page }) => {
    await signInAsDebugUser(page, "/account/settings/preferences");

    const response = await page.request.get(
      "/account/settings?tab=preferences",
      {
        maxRedirects: 0,
      },
    );

    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe("/account/settings/preferences");
  });

  test("外观选择立即应用并写入既有 localStorage", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAsDebugUser(page, "/account/settings/preferences");

    const preferences = page.getByRole("region", {
      name: /偏好设置|Preferences/i,
    });
    const dark = preferences.getByRole("radio", {
      name: /^(深色|Dark)$/i,
    });

    await dark.click();

    await expect(dark).toBeChecked();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("life-ustc-theme")))
      .toBe("dark");
    await expectNoPageHorizontalOverflow(page);

    await page.emulateMedia({ colorScheme: "dark" });
    await preferences
      .getByRole("radio", { name: /^(跟随系统|System)$/i })
      .click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await captureStepScreenshot(page, testInfo, "settings-preferences-mobile");
  });

  test("语言选择复用 locale API 且 URL 不增加语言目录", async ({
    page,
  }, testInfo) => {
    await page.request.post("/api/account/preferences", {
      data: { locale: "zh-cn" },
    });
    await signInAsDebugUser(page, "/account/settings/preferences");

    const localeResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/account/preferences") &&
        response.request().method() === "POST",
    );
    await page
      .getByRole("region", { name: /偏好设置|Preferences/i })
      .getByRole("radio", { name: /^English$/i })
      .click();
    expect((await localeResponse).status()).toBe(200);

    await expect(page).toHaveURL(/\/account\/settings\/preferences$/);
    await expect(page).not.toHaveURL(/\/(?:zh-cn|en-us)\//);
    await expect(
      page.getByRole("region", { name: "Preferences" }),
    ).toBeVisible();
    await captureStepScreenshot(page, testInfo, "settings-preferences-english");
  });
});
