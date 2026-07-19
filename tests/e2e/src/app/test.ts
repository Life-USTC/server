import { expect, test } from "@playwright/test";
import { signInAsDebugUser, signInAsDevAdmin } from "../../utils/auth";
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

test("/ 登录用户重定向至 dashboard 并仅保留支持的查询状态", async ({
  page,
}) => {
  await signInAsDebugUser(page, "/dashboard");

  const response = await page.request.get(
    "/?tab=calendar&calendarView=week&calendarSemester=42&utm_source=ignored",
    { maxRedirects: 0 },
  );

  expect(response.status()).toBe(303);
  expect(response.headers().location).toBe(
    "/dashboard?tab=calendar&calendarView=week&calendarSemester=42",
  );
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

test("/ shell 匿名 390px 抽屉只展示公开导航", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoAndWaitForReady(page, "/");

  await page
    .locator("[data-shell-topbar]")
    .getByRole("button", { name: /^菜单$|^Menu$/i })
    .click();

  const sidebar = page.getByRole("dialog", { name: /Sidebar/i });
  for (const name of [
    /^(校车|Shuttle Bus)$/i,
    /^(网站|Websites)$/i,
    /^(课程|Courses)$/i,
    /^(班级|Sections)$/i,
    /^(教师|Teachers)$/i,
  ]) {
    await expect(sidebar.getByRole("link", { name })).toBeVisible();
  }
  for (const name of [
    /^(待办|Todos)$/i,
    /^(考试|Exams)$/i,
    /^(关注班级|Section Management)$/i,
  ]) {
    await expect(sidebar.getByRole("link", { name })).toHaveCount(0);
  }
  await expect(
    page.getByRole("navigation", {
      name: /移动主导航|Mobile primary navigation/i,
    }),
  ).toHaveCount(0);
});

test("/ 主题切换可写入 localStorage 并跟随系统主题", async ({
  page,
}, testInfo) => {
  await gotoAndWaitForReady(page, "/", { testInfo, screenshotLabel: "home" });

  const themeButton = page.getByRole("button", {
    name: /^(主题选择|Theme selector)$/i,
  });
  await expect(themeButton).toBeVisible();

  async function selectTheme(name: RegExp, value: "light" | "dark" | "system") {
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

  await page.emulateMedia({ colorScheme: "dark" });
  await selectTheme(/^(跟随系统|System)$/i, "system");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await captureStepScreenshot(page, testInfo, "theme-system-light");
});

test("/ 存储的深色主题在 hydration 前应用且通过 CSP", async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    baseURL: String(testInfo.project.use.baseURL),
    colorScheme: "light",
  });
  await context.addInitScript(() => {
    localStorage.setItem("life-ustc-theme", "dark");
  });
  const page = await context.newPage();
  await page.route("**/_app/immutable/**/*.js", (route) => route.abort());

  const response = await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-life-ustc-hydrated",
    "true",
  );
  const bootstrapNonce = await page
    .locator("head > script")
    .first()
    .evaluate((script: HTMLScriptElement) => script.nonce);
  expect(bootstrapNonce).toBeTruthy();
  expect(response?.headers()["content-security-policy"]).toContain(
    `'nonce-${bootstrapNonce}'`,
  );
  await context.close();
});

test("/ 禁用 JavaScript 时系统深色主题仍有 CSS fallback", async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    baseURL: String(testInfo.project.use.baseURL),
    colorScheme: "dark",
    javaScriptEnabled: false,
  });
  const page = await context.newPage();

  const response = await page.goto("/", { waitUntil: "domcontentloaded" });

  expect(response?.status()).toBe(200);
  await expect(page.locator("#main-content")).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  expect(
    await page
      .locator("html")
      .evaluate((element) => getComputedStyle(element).colorScheme),
  ).toBe("dark");
  await context.close();
});

test("/ shell 提供键盘跳转到主要内容", async ({ page }) => {
  await gotoAndWaitForReady(page, "/");

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", {
    name: /跳转到主要内容|Skip to main content/i,
  });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
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
    sidebar.getByRole("link", { name: /班级|Sections/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: /设置|Settings/i }),
  ).toHaveCount(0);
});

test("/ shell 桌面导航以任务为一级入口且当前位置唯一", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signInAsDebugUser(page, "/dashboard/calendar");

  const sidebar = page.getByTestId("app-sidebar");
  const navigation = sidebar.getByRole("navigation", {
    name: /主导航|Primary navigation/i,
  });

  for (const name of [
    /^(今天|Today)$/i,
    /^(日历|Calendar)$/i,
    /^(作业|Homework)$/i,
    /^(待办|Todos)$/i,
    /^(考试|Exams)$/i,
    /^(关注班级|Section Management)$/i,
  ]) {
    await expect(navigation.getByRole("link", { name })).toBeVisible();
  }

  await expect(
    navigation.getByRole("link", { name: /^(仪表盘|Dashboard)$/i }),
  ).toHaveCount(0);
  await expect(
    navigation.getByRole("button", { name: /^Toggle /i }),
  ).toHaveCount(0);
  await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(
    navigation.getByRole("link", { name: /^(日历|Calendar)$/i }),
  ).toHaveAttribute("aria-current", "page");

  const explore = navigation.getByRole("button", {
    name: /^(发现|Explore)$/i,
  });
  await expect(explore).toHaveAttribute("aria-expanded", "false");
  await explore.click();
  await expect(
    navigation.getByRole("link", { name: /^(课程|Courses)$/i }),
  ).toBeVisible();
});

test("/ shell 当前分组在导航后保持展开", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signInAsDebugUser(page, "/dashboard/calendar");

  const navigation = page.getByTestId("app-sidebar").getByRole("navigation", {
    name: /主导航|Primary navigation/i,
  });
  const explore = navigation.getByRole("button", {
    name: /^(发现|Explore)$/i,
  });

  await explore.click();
  await expect(explore).toHaveAttribute("aria-expanded", "true");
  await expect(
    navigation.getByRole("link", { name: /^(课程|Courses)$/i }),
  ).toBeVisible();
  await explore.click();
  await expect(explore).toHaveAttribute("aria-expanded", "false");

  await page.evaluate(() => {
    const link = document.createElement("a");
    link.dataset.testNavigation = "courses";
    link.href = "/courses";
    link.textContent = "Navigate to Courses";
    document.querySelector("#main-content")?.append(link);
  });
  await page.locator('[data-test-navigation="courses"]').click();
  await page.waitForURL("**/courses");
  await waitForUiSettled(page);

  await expect(explore).toHaveAttribute("aria-expanded", "true");
  await expect(
    navigation.getByRole("link", { name: /^(课程|Courses)$/i }),
  ).toHaveAttribute("aria-current", "page");
  await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);
});

test("/ shell 390px 主导航可达且触控尺寸达标", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAsDevAdmin(page, "/dashboard/todos");

  const primaryNavigation = page.getByRole("navigation", {
    name: /移动主导航|Mobile primary navigation/i,
  });
  const primaryNames = [
    /^(今天|Today)$/i,
    /^(日历|Calendar)$/i,
    /^(任务|Tasks)$/i,
    /^(发现|Explore)$/i,
    /^(我的|Me)$/i,
  ];

  for (const name of primaryNames) {
    const link = primaryNavigation.getByRole("link", { name });
    await expect(link).toBeVisible();
    const box = await link.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }

  await expect(primaryNavigation.locator('[aria-current="page"]')).toHaveCount(
    1,
  );
  await expect(
    primaryNavigation.getByRole("link", { name: /^(任务|Tasks)$/i }),
  ).toHaveAttribute("aria-current", "page");
  await captureStepScreenshot(page, testInfo, "shell/mobile-primary");

  const topbar = page.locator("[data-shell-topbar]");
  await expect(
    topbar.getByRole("button", { name: /语言|Language/i }),
  ).toHaveCount(0);
  await expect(topbar.getByRole("button", { name: /主题|Theme/i })).toHaveCount(
    0,
  );

  for (const button of [
    topbar.getByRole("button", { name: /^菜单$|^Menu$/i }),
    topbar.getByRole("button", { name: /个人菜单|Profile menu/i }),
  ]) {
    const box = await button.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }

  await topbar.getByRole("button", { name: /^菜单$|^Menu$/i }).click();

  const sidebar = page.getByRole("dialog", { name: /Sidebar/i });
  await expect(sidebar).toBeVisible();
  await expect(
    sidebar.getByRole("button", { name: /^(次级导航|Secondary)$/i }),
  ).toBeVisible();
  await expect(
    sidebar.getByRole("button", { name: /^(管理工具|Admin tools)$/i }),
  ).toBeVisible();
  await expect(
    sidebar.getByRole("button", { name: /语言|Language/i }),
  ).toBeVisible();
  await expect(
    sidebar.getByRole("button", { name: /主题|Theme/i }),
  ).toBeVisible();
  await expect(sidebar.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(
    sidebar.getByRole("link", { name: /^(待办|Todos)$/i }),
  ).toHaveAttribute("aria-current", "page");
  await expect(sidebar.getByRole("button", { name: /^Toggle /i })).toHaveCount(
    0,
  );
  await captureStepScreenshot(page, testInfo, "shell/mobile-secondary");
});

test("/ shell 390px 设置子路由保持唯一当前位置", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAsDebugUser(page, "/settings/accounts");

  const primaryNavigation = page.getByRole("navigation", {
    name: /移动主导航|Mobile primary navigation/i,
  });
  await expect(
    primaryNavigation.getByRole("link", { name: /^(我的|Me)$/i }),
  ).toHaveAttribute("aria-current", "page");

  await page
    .locator("[data-shell-topbar]")
    .getByRole("button", { name: /^菜单$|^Menu$/i })
    .click();

  const sidebar = page.getByRole("dialog", { name: /Sidebar/i });
  await expect(
    sidebar.getByRole("link", { name: /^(设置|Settings)$/i }),
  ).toHaveAttribute("aria-current", "page");
  await expect(sidebar.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(primaryNavigation.locator('[aria-current="page"]')).toHaveCount(
    0,
  );
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
