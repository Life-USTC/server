import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../utils/auth";
import { DEV_SEED } from "../../utils/dev-seed";
import {
  getCurrentSessionUser,
  getUserProfileById,
  getUserSubscribedSectionIds,
  replaceUserSubscribedSectionIds,
  updateUserProfileById,
} from "../../utils/e2e-db";
import { gotoAndWaitForReady, waitForUiSettled } from "../../utils/page-ready";
import { captureStepScreenshot } from "../../utils/screenshot";
import { assertPageContract } from "./_shared/page-contract";

test.describe.configure({ mode: "serial" });

test("/", async ({ page }, testInfo) => {
  await assertPageContract(page, { routePath: "/", testInfo });
});

test("/ 首页快速入口可见", async ({ page }, testInfo) => {
  await gotoAndWaitForReady(page, "/", { testInfo, screenshotLabel: "home" });

  await expect(page.locator("#app-logo")).toBeVisible();
  await expect(page.locator("#app-user-menu")).toHaveCount(0);
  // Bus is the default public tab; both bus and links tabs are visible in nav
  await expect(
    page.getByRole("tab", { name: /^(校车|Shuttle Bus)$/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: /^(网站|Websites)$/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /^(登录|Sign in)$/i }).first(),
  ).toBeVisible();
  await captureStepScreenshot(page, testInfo, "home-shortcuts");
});

test("/ 主题切换可写入 localStorage", async ({ page }, testInfo) => {
  await gotoAndWaitForReady(page, "/", { testInfo, screenshotLabel: "home" });

  const themeButton = page.getByRole("button", {
    name: /切换到浅色模式|切换到深色模式|使用系统偏好|Switch to light mode|Switch to dark mode|Use system preference/i,
  });
  await expect(themeButton).toBeVisible();

  await expect(async () => {
    await themeButton.click();
    await expect
      .poll(
        async () =>
          page.evaluate(() => localStorage.getItem("life-ustc-theme")),
        { timeout: 2_000 },
      )
      .toBe("light");
  }).toPass({
    timeout: 10_000,
    intervals: [250, 500, 1_000],
  });
  await captureStepScreenshot(page, testInfo, "theme-light");

  await expect(async () => {
    await themeButton.click();
    await expect
      .poll(
        async () =>
          page.evaluate(() => localStorage.getItem("life-ustc-theme")),
        { timeout: 2_000 },
      )
      .toBe("dark");
  }).toPass({
    timeout: 10_000,
    intervals: [250, 500, 1_000],
  });
  await captureStepScreenshot(page, testInfo, "theme-dark");
});

test("/ 登录用户在空状态总览页可看到班级发现入口", async ({
  page,
}, testInfo) => {
  test.setTimeout(300_000);
  await signInAsDebugUser(page, "/");

  const sessionUser = await getCurrentSessionUser(page);
  const originalProfile = await getUserProfileById(sessionUser.id);
  const originalSectionIds = await getUserSubscribedSectionIds(sessionUser.id);

  await updateUserProfileById(sessionUser.id, {
    name: originalProfile.name ?? DEV_SEED.debugName,
    username: originalProfile.username ?? DEV_SEED.debugUsername,
    image: originalProfile.image,
  });
  await replaceUserSubscribedSectionIds(sessionUser.id, []);
  expect(await getUserSubscribedSectionIds(sessionUser.id)).toEqual([]);

  try {
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForUiSettled(page);
    await expect(page.locator("#main-content")).toBeVisible();

    await expect(
      page.getByRole("link", { name: /浏览班级|Browse Sections/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /浏览课程|Browse Courses/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /按代码匹配|Match by Code/i }),
    ).toBeVisible();

    await captureStepScreenshot(page, testInfo, "dashboard-overview-empty");
  } finally {
    await updateUserProfileById(sessionUser.id, originalProfile);
    await replaceUserSubscribedSectionIds(sessionUser.id, originalSectionIds);
  }
});
