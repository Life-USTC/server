import { expect } from "@playwright/test";
import { test } from "../../../utils/isolated-worker";
import { gotoAndWaitForReady } from "../../../utils/page-ready";

test("ui.settings-navigation-4", async ({ page, isolatedWorker }, testInfo) => {
  const actor = await isolatedWorker.createActor();
  await page
    .context()
    .addCookies([
      actor.cookie,
      { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
    ]);
  await page.setViewportSize({ width: 1280, height: 844 });
  await gotoAndWaitForReady(page, "/account/settings/preferences");
  const preferenceRequests: unknown[] = [];
  page.on("request", (request) => {
    if (
      new URL(request.url()).pathname === "/api/account/preferences" &&
      request.method() === "POST"
    )
      preferenceRequests.push(request.postDataJSON());
  });
  const preferences = page.getByRole("region", {
    name: "Preferences",
    exact: true,
  });
  await preferences.getByRole("radio", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    preferences.getByRole("radio", { name: "Dark", exact: true }),
  ).toBeChecked();
  await page
    .getByRole("button", { name: "Theme selector", exact: true })
    .click();
  await expect(
    page.getByRole("menuitemradio", { name: "Dark", exact: true }),
  ).toBeChecked();
  await page.getByRole("menuitemradio", { name: "Light", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.screenshot({
    path: testInfo.outputPath("settings-shared-theme.png"),
  });
  await expect(
    preferences.getByRole("radio", { name: "Light", exact: true }),
  ).toBeChecked();
  expect(
    await page.evaluate(() => localStorage.getItem("life-ustc-theme")),
  ).toBe("light");
  expect(preferenceRequests).toEqual([]);
  for (const [locale, language, region] of [
    ["zh-cn", "中文", "偏好设置"],
    ["en-us", "English", "Preferences"],
  ]) {
    const responsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/account/preferences" &&
        response.request().method() === "POST",
    );
    await page.getByRole("radio", { name: language, exact: true }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    expect(response.request().postDataJSON()).toEqual({ locale });
    expect(
      (await page.context().cookies()).find(
        (cookie) => cookie.name === "NEXT_LOCALE",
      )?.value,
    ).toBe(locale);
    await expect(
      page.getByRole("region", { name: region, exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/account\/settings\/preferences$/);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(
      await page.evaluate(() => localStorage.getItem("life-ustc-theme")),
    ).toBe("light");
  }
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-us");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(
    await page.evaluate(() => localStorage.getItem("life-ustc-theme")),
  ).toBe("light");
  expect(preferenceRequests).toEqual([
    { locale: "zh-cn" },
    { locale: "en-us" },
  ]);
});
