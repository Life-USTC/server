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
    page.getByRole("link", { name: /^(校车|Shuttle Bus)$/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /^(网站|Websites)$/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /^(登录|Sign in)$/i }).first(),
  ).toBeVisible();
  await captureStepScreenshot(page, testInfo, "home-shortcuts");
});

test("/ 主题切换可写入 localStorage", async ({ page }, testInfo) => {
  await gotoAndWaitForReady(page, "/", { testInfo, screenshotLabel: "home" });

  const themeButton = page.getByRole("button", {
    name: /^(主题选择|Theme selector)$/i,
  });
  await expect(themeButton).toBeVisible();

  await expect(async () => {
    await themeButton.click();
    await page.getByRole("menuitemradio", { name: /^(浅色|Light)$/i }).click();
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
    await page.getByRole("menuitemradio", { name: /^(深色|Dark)$/i }).click();
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

test("/ shell 菜单可一键切换", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await signInAsDebugUser(page, "/");

  const profileMenuButton = page.getByRole("button", {
    name: /个人菜单|Profile menu/i,
  });
  await profileMenuButton.click();
  await expect(
    page.getByRole("menuitem", { name: /设置|Settings/i }),
  ).toBeVisible();

  await page.getByRole("button", { name: /^菜单$|^Menu$/i }).click();

  const sidebar = page.getByRole("dialog", { name: /Sidebar/i });
  await expect(sidebar).toBeVisible();
  await expect(
    sidebar.getByRole("link", { name: /课程|Courses/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: /设置|Settings/i }),
  ).toHaveCount(0);
});

test("/ shell 菜单支持键盘菜单语义", async ({ page }) => {
  await signInAsDebugUser(page, "/");

  const profileMenuButton = page.getByRole("button", {
    name: /个人菜单|Profile menu/i,
  });
  await profileMenuButton.focus();
  await page.keyboard.press("Enter");

  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  const homeItem = page.getByRole("menuitem", { name: /首页|Home/i });
  await expect(homeItem).toBeFocused();
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(resolve)),
  );

  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("menuitem", { name: /^(我的|Me)$/i }),
  ).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(profileMenuButton).toBeFocused();

  const languageButton = page.getByRole("button", {
    name: /语言|Language/i,
  });
  await languageButton.focus();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("menu")).toBeVisible();
  const radioItems = page.getByRole("menuitemradio");
  await expect(radioItems).toHaveCount(2);
  const checkedStates = await radioItems.evaluateAll((items) =>
    items.map((item) => item.getAttribute("aria-checked")),
  );
  expect(checkedStates.filter((state) => state === "true")).toHaveLength(1);
});

test("/ shell 桌面导航后内容滚动回到顶部", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoAndWaitForReady(page, "/terms");

  await page.evaluate(() => {
    window.scrollTo(0, 720);
    document
      .querySelector(
        '[data-shell-scroll-container] [data-slot="scroll-area-viewport"]',
      )
      ?.scrollTo({ top: 720 });
  });

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const contentPane = document.querySelector(
          '[data-shell-scroll-container] [data-slot="scroll-area-viewport"]',
        );
        return Math.max(window.scrollY, contentPane?.scrollTop ?? 0);
      }),
    )
    .toBeGreaterThan(100);

  await page
    .getByTestId("app-sidebar")
    .getByRole("link", { name: /^(课程|Courses)$/i })
    .click();
  await page.waitForURL("**/courses");
  await waitForUiSettled(page);

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const contentPane = document.querySelector(
          '[data-shell-scroll-container] [data-slot="scroll-area-viewport"]',
        );
        return Math.max(window.scrollY, contentPane?.scrollTop ?? 0);
      }),
    )
    .toBeLessThan(8);
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
