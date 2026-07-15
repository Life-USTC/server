import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../utils/auth";
import { DEV_SEED } from "../../utils/dev-seed";
import {
  getCurrentSessionUser,
  getSeedSectionSemesterFixture,
  getUserProfileById,
  getUserSubscribedSectionIds,
  replaceUserSubscribedSectionIds,
  updateUserProfileById,
} from "../../utils/e2e-db";
import { gotoAndWaitForReady, waitForUiSettled } from "../../utils/page-ready";
import { captureStepScreenshot } from "../../utils/screenshot";
import { resolveSeedSectionMatches } from "../../utils/seed-lookups";
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

  async function selectTheme(name: RegExp, value: "light" | "dark") {
    const menuItem = page.getByRole("menuitemradio", { name });

    await expect(async () => {
      if (!(await menuItem.isVisible().catch(() => false))) {
        await themeButton.click();
      }
      await expect(menuItem).toBeVisible({ timeout: 1_000 });
      await menuItem.click();
      await expect
        .poll(
          async () =>
            page.evaluate(() => localStorage.getItem("life-ustc-theme")),
          { timeout: 1_000 },
        )
        .toBe(value);
    }).toPass({
      timeout: 10_000,
      intervals: [250, 500, 1_000],
    });
  }

  await selectTheme(/^(浅色|Light)$/i, "light");
  await captureStepScreenshot(page, testInfo, "theme-light");

  await selectTheme(/^(深色|Dark)$/i, "dark");
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
      .querySelector("[data-shell-scroll-container]")
      ?.scrollTo({ top: 720 });
  });

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const contentPane = document.querySelector(
          "[data-shell-scroll-container]",
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
          "[data-shell-scroll-container]",
        );
        return Math.max(window.scrollY, contentPane?.scrollTop ?? 0);
      }),
    )
    .toBeLessThan(8);
});

test("/ shell 折叠桌面侧边栏后图标链接仍可跳转", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoAndWaitForReady(page, "/");

  const sidebar = page.getByTestId("app-sidebar");
  const coursesLink = sidebar.getByRole("link", {
    name: /^(课程|Courses)$/i,
  });

  const catalogGroup = sidebar.getByRole("button", {
    name: /^(课程目录|Catalog)$/i,
  });
  await expect(async () => {
    await catalogGroup.click();
    await expect(coursesLink).toHaveCount(0, { timeout: 1_000 });
  }).toPass({ timeout: 10_000, intervals: [250, 500, 1_000] });

  await page.locator('[data-sidebar="rail"]').click();

  await expect(
    page.locator('[data-slot="sidebar"][data-state="collapsed"]'),
  ).toBeVisible();

  await expect(coursesLink).toBeVisible();
  await coursesLink.click();

  await page.waitForURL("**/courses");
  await waitForUiSettled(page);
  await expect(page).toHaveURL(/\/courses(?:\?.*)?$/);
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

test("/ 仅关注往期班级时可恢复历史作业和课表入口", async ({
  page,
}, testInfo) => {
  test.setTimeout(300_000);
  await signInAsDebugUser(page, "/");

  const sessionUser = await getCurrentSessionUser(page);
  const originalSectionIds = await getUserSubscribedSectionIds(sessionUser.id);
  const previousSection = (await resolveSeedSectionMatches(page)).find(
    (section) => section.code === DEV_SEED.previousSection.code,
  );
  expect(previousSection).toBeDefined();
  if (!previousSection) return;
  const previousSemester = await getSeedSectionSemesterFixture(
    DEV_SEED.previousSection.jwId,
  );
  expect(previousSemester.semesterId).not.toBeNull();

  await replaceUserSubscribedSectionIds(sessionUser.id, [previousSection.id]);

  try {
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForUiSettled(page);

    await expect(
      page.getByText(
        /往期班级、作业和课表仍然保留|past sections, homework, and schedules are still available/i,
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /查看往期作业|View Past Homework/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /查看往期课表|View Past Schedule/i }),
    ).toHaveAttribute(
      "href",
      `/dashboard/calendar?calendarSemester=${previousSemester.semesterId}`,
    );
    await expect(
      page.getByRole("link", { name: /查看往期班级|View Past Sections/i }),
    ).toBeVisible();

    const response = await page.request.get("/api/me/subscriptions/homeworks");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      homeworks?: Array<{ title?: string }>;
      sectionIds?: number[];
    };
    expect(body.sectionIds).toEqual([previousSection.id]);
    expect(body.homeworks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: DEV_SEED.homeworks.historicalTitle }),
      ]),
    );

    const schedulesResponse = await page.request.get(
      `/api/me/subscriptions/schedules?dateFrom=${DEV_SEED.previousSemesterScheduleDates[0]}&dateTo=${DEV_SEED.previousSemesterScheduleDates[1]}`,
    );
    expect(schedulesResponse.status()).toBe(200);
    const schedulesBody = (await schedulesResponse.json()) as {
      schedules?: Array<{ section?: { id?: number } }>;
    };
    expect(schedulesBody.schedules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section: expect.objectContaining({ id: previousSection.id }),
        }),
      ]),
    );

    await captureStepScreenshot(page, testInfo, "dashboard-history-recovery");
    await page
      .getByRole("link", { name: /查看往期作业|View Past Homework/i })
      .click();
    await expect(page).toHaveURL(/\/dashboard\/homeworks/);
    await expect(
      page.getByText(DEV_SEED.homeworks.historicalTitle),
    ).toBeVisible();

    await page.goto("/");
    await waitForUiSettled(page);
    await page
      .getByRole("link", { name: /查看往期课表|View Past Schedule/i })
      .click();
    await expect(page).toHaveURL(
      new RegExp(
        `/dashboard/calendar\\?calendarSemester=${previousSemester.semesterId}$`,
      ),
    );
    await expect(
      page.getByText(/线性代数进阶|Advanced Linear Algebra/i).first(),
    ).toBeVisible();
  } finally {
    await replaceUserSubscribedSectionIds(sessionUser.id, originalSectionIds);
  }
});
