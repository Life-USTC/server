import { expect, type Page } from "@playwright/test";
import { test } from "../../../utils/account-fixture";
import { gotoAndWaitForReady } from "../../../utils/page-ready";

const labels = {
  "en-us": {
    title: "All features",
    homeTitle: "Overview",
    search: "Search features",
    clear: "Clear search",
    empty: "No features match your search.",
    day: "Workspace",
    courses: "Courses",
    activities: "Activities",
    apps: "Apps",
    campus: "Campus",
    account: "Account",
    admin: "Admin",
    homework: "Homework",
    query: "homework progress",
  },
  "zh-cn": {
    title: "全部功能",
    homeTitle: "总览",
    search: "搜索功能",
    clear: "清除搜索",
    empty: "没有匹配的功能。",
    day: "工作台",
    courses: "课程",
    activities: "活动",
    apps: "应用",
    campus: "校园",
    account: "账户",
    admin: "管理",
    homework: "作业",
    query: "作业 完成",
  },
};
const publicPaths = [
  "/catalog/courses",
  "/catalog/sections",
  "/catalog/teachers",
  "/catalog/rooms",
  "/catalog/bus",
  "/catalog/weather",
  "/catalog/young-events",
  "/news",
  "/catalog/links",
  "/usage/mobile",
  "/usage/bot",
  "/usage/mcp",
  "/usage/cli",
];
const userPaths = [
  "/workspace/calendar",
  "/workspace/homeworks",
  "/workspace/todos",
  "/workspace/exams",
  "/workspace/subscriptions",
  "/workspace/subscriptions/activities?view=notifications",
  "/workspace/uploads",
  "/account/settings/profile",
];
const adminPaths = [
  "/admin/users",
  "/admin/moderation",
  "/admin/oauth",
  "/admin/bus",
];
async function hrefs(page: Page, selector: string) {
  return page
    .locator(selector)
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
}

for (const locale of ["en-us", "zh-cn"] as const) {
  for (const role of ["anonymous", "user", "admin"] as const) {
    test(`feature hub ${locale} ${role}`, { tag: "@Site/Web" }, async ({
      page,
      isolatedWorker,
      run,
    }) => {
      test.setTimeout(120_000);
      const copy = labels[locale];
      if (role !== "anonymous") {
        const user = await run(() =>
          isolatedWorker.database.owner.user.create({
            data: {
              name: "Feature hub user",
              username: "feature-hub-user",
              email: "feature-hub@example.test",
              isAdmin: role === "admin",
            },
          }),
        );
        await page
          .context()
          .addCookies([(await isolatedWorker.createSession(user.id)).cookie]);
      }
      await page
        .context()
        .addCookies([
          { name: "NEXT_LOCALE", value: locale, url: isolatedWorker.origin },
        ]);
      const expected = [
        ...publicPaths,
        ...(role !== "anonymous" ? userPaths : []),
        ...(role === "admin" ? adminPaths : []),
      ].sort();
      let desktopLinks: (string | null)[] = [];
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 844 });
        await gotoAndWaitForReady(page, "/");
        const main = page.locator("#main-content");
        const hub = page.locator("[data-feature-hub]");
        await expect(main.getByRole("heading", { level: 1 })).toHaveText(
          copy.homeTitle,
        );
        await expect(page).toHaveTitle(`${copy.homeTitle} - Life@USTC`);
        await expect
          .poll(async () =>
            (
              await hrefs(page, "[data-feature-hub] [data-feature-entry] > a")
            ).sort(),
          )
          .toEqual(expected);
        await expect(
          hub.getByRole("heading", { name: copy.courses, exact: true }),
        ).toBeVisible();
        await expect(
          hub.getByRole("heading", { name: copy.campus, exact: true }),
        ).toBeVisible();
        await expect(
          hub.getByRole("heading", { name: copy.account, exact: true }),
        ).toHaveCount(role === "anonymous" ? 0 : 1);
        await expect(
          hub.getByRole("heading", { name: copy.admin, exact: true }),
        ).toHaveCount(role === "admin" ? 1 : 0);
        const mobilePrimary = page.locator("[data-mobile-primary-navigation]");
        if (width < 1024) await expect(mobilePrimary).toBeVisible();
        else await expect(mobilePrimary).toBeHidden();
        await expect(
          page
            .locator("[data-shell-topbar]")
            .getByRole("link", { name: copy.title, exact: true }),
        ).toHaveCount(0);
        const groupNames = [
          ...(role === "anonymous" ? [] : [copy.day]),
          copy.courses,
          copy.campus,
          copy.activities,
          ...(role === "anonymous" ? [] : [copy.account]),
          copy.apps,
          ...(role === "admin" ? [copy.admin] : []),
        ];
        await expect(hub.locator("section > h3")).toHaveText(groupNames);
        const courses = hub.getByRole("region", {
          name: copy.courses,
          exact: true,
        });
        await expect(
          courses.locator('[data-feature-entry] [data-slot="item-title"]'),
        ).toHaveText(
          locale === "zh-cn"
            ? ["浏览教学班", "浏览课程", "教师"]
            : ["Browse sections", "Browse courses", "Teachers"],
        );
        const activities = hub.getByRole("region", {
          name: copy.activities,
          exact: true,
        });
        await expect(
          activities.locator('a[href="/catalog/young-events/calendar"]'),
        ).toBeVisible();
        await expect(
          activities.locator('a[href="/catalog/young-events/organizers"]'),
        ).toBeVisible();
        await expect(
          activities.locator(
            'a[href="/workspace/subscriptions/activities?view=notifications"]',
          ),
        ).toHaveCount(0);
        if (width < 768)
          await page
            .locator('[data-shell-topbar] [data-sidebar="trigger"]')
            .click();
        const navigation = page.locator(
          `[data-shell-navigation="${width < 768 ? "mobile" : "desktop"}"]`,
        );
        await expect(navigation).toBeVisible();
        // The feature directory keeps all destinations; the sidebar renders only
        // one selected level, never the old all-feature inline tree.
        if (role !== "anonymous") {
          await expect(navigation).toHaveAttribute(
            "data-shell-navigation-view",
            "workspace",
          );
          await navigation.locator("[data-local-navigation-back]").click();
        }
        await expect(navigation).toHaveAttribute(
          "data-shell-navigation-view",
          "root",
        );
        await expect(navigation).toHaveAccessibleName(
          locale === "zh-cn" ? "主导航" : "Primary navigation",
        );
        const links = await navigation
          .locator(
            '[data-slot="sidebar-content"] a[data-sidebar="menu-button"]',
          )
          .evaluateAll((nodes) =>
            nodes.map((node) => node.getAttribute("href")),
          );
        expect(links).toEqual([
          "/",
          role === "anonymous"
            ? "/account/sign-in?callbackUrl=%2Fworkspace%2Fcalendar"
            : "/workspace/calendar",
          "/campus",
          "/catalog/young-events",
        ]);
        await expect(
          navigation.locator(
            '[data-slot="sidebar-menu-sub"], button[data-slot="sidebar-group-label"], [data-slot="sidebar-menu-action"]',
          ),
        ).toHaveCount(0);
        await expect(
          navigation.locator(
            '[data-slot="sidebar-content"] a[data-sidebar="menu-button"]',
          ),
        ).toHaveText(
          locale === "zh-cn"
            ? ["工作台", "日历", "校园", "活动"]
            : ["Workspace", "Calendar", "Campus", "Activities"],
        );
        if (width >= 768) desktopLinks = links;
        else expect(links).toEqual(desktopLinks);
        await expect(
          navigation.locator('a[href="/terms"], a[href="/privacy"]'),
        ).toHaveCount(0);
        await expect(
          navigation.locator('a[href^="/catalog/sections/"]'),
        ).toHaveCount(0);
        await expect(navigation.locator('a[aria-current="page"]')).toHaveCount(
          1,
        );
        await expect(
          navigation.locator('a[aria-current="page"]'),
        ).toHaveAttribute("href", "/");
        if (role !== "anonymous") {
          if (width < 768) await page.keyboard.press("Escape");
          const profile = page
            .locator("[data-shell-topbar] #app-user-menu")
            .getByRole("button", {
              name: locale === "zh-cn" ? "个人菜单" : "Profile menu",
              exact: true,
            });
          await expect(profile).toHaveCount(1);
          await profile.click();
          const menu = page.getByRole("menu");
          await expect(
            menu.getByRole("menuitem", {
              name: locale === "zh-cn" ? "我的上传" : "My Uploads",
              exact: true,
            }),
          ).toHaveAttribute("href", "/workspace/uploads");
          await expect(
            menu.locator('a[href="/account/settings/preferences"]'),
          ).toHaveCount(1);
          await expect(menu.locator('a[href="/admin/users"]')).toHaveCount(
            role === "admin" ? 1 : 0,
          );
          await page.keyboard.press("Escape");
          if (width < 768)
            await page
              .locator('[data-shell-topbar] [data-sidebar="trigger"]')
              .click();
        }
        if (width < 768) {
          await page.keyboard.press("Escape");
          await expect(navigation).toBeHidden();
        }
        const search = main.getByRole("searchbox", { name: copy.search });
        if (role !== "anonymous") {
          await search.fill(copy.query);
          await expect(hub.locator("[data-feature-entry] > a")).toHaveCount(1);
          // The row is the link, so its accessible name carries the
          // description too; the name is asserted on the row title.
          await expect(
            hub.locator('[data-feature-entry] [data-slot="item-title"]'),
          ).toHaveText(copy.homework);
          await expect(hub.locator("[data-feature-entry] > a")).toHaveAttribute(
            "href",
            "/workspace/homeworks",
          );
          await main
            .getByRole("button", { name: copy.clear, exact: true })
            .click();
        }
        await search.fill("/catalog/bus/map");
        await expect(hub.locator("[data-feature-entry] > a")).toHaveCount(1);
        await expect(hub.locator('a[href="/catalog/bus/map"]')).toBeVisible();
        await search.fill("no-such-feature-1215");
        await expect(hub.getByRole("status")).toContainText(copy.empty);
        await expect(hub.locator("[data-feature-entry] > a")).toHaveCount(0);
        await hub
          .getByRole("button", { name: copy.clear, exact: true })
          .click();
        await expect(search).toHaveValue("");
        await expect(hub.locator("[data-feature-entry] > a")).toHaveCount(
          expected.length,
        );
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        await hub.locator('a[href="/catalog/courses"]').click();
        await expect(page).toHaveURL(/\/catalog\/courses$/);
        await page
          .getByRole("link", { name: /^Life@USTC: (Home|首页)$/, exact: true })
          .filter({ visible: true })
          .first()
          .click();
        await expect(page).toHaveURL(`${isolatedWorker.origin}/`);
      }
      expect(errors).toEqual([]);
    });
  }
}

test("home and navigation stay reachable through the tablet range", {
  tag: "@Site/Web",
}, async ({ page }) => {
  for (const width of [768, 900, 1023]) {
    await page.setViewportSize({ width, height: 900 });
    await gotoAndWaitForReady(page, "/");
    const topbar = page.locator("[data-shell-topbar]");
    await expect(topbar.locator("[data-shell-brand]")).toBeVisible();
    const menu = topbar.locator('[data-sidebar="trigger"]');
    await expect(menu).toBeVisible();
    await expect(topbar.locator('a[href="/catalog/features"]')).toHaveCount(0);
    await menu.focus();
    await page.keyboard.press("Enter");
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await gotoAndWaitForReady(page, "/");
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await menu.focus();
    await page.keyboard.press("Enter");
    await expect(menu).toHaveAttribute("aria-expanded", "false");
  }
});

for (const locale of ["en-us", "zh-cn"] as const) {
  test(`feature hub compact topbar ${locale}`, { tag: "@Site/Web" }, async ({
    page,
    isolatedWorker,
  }) => {
    await page
      .context()
      .addCookies([
        { name: "NEXT_LOCALE", value: locale, url: isolatedWorker.origin },
      ]);
    for (const width of [280, 320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await gotoAndWaitForReady(page, "/", {
        expectNoHorizontalOverflow: true,
      });
      const topbar = page.locator("[data-shell-topbar]");
      await expect(
        topbar.getByRole("link", { name: labels[locale].title, exact: true }),
      ).toHaveCount(0);
      await expect(topbar.locator('a[href="/account/sign-in"]')).toBeVisible();
    }
  });
}
