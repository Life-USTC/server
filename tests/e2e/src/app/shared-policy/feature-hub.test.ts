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
    day: "My day",
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
    day: "日程",
    courses: "课程",
    activities: "第二课堂",
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
        await expect(
          page.locator(
            '[data-shell-navigation="mobile-primary"], [data-shell-navigation="admin-mobile"], [data-shell-navigation="secondary"]',
          ),
        ).toHaveCount(0);
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
            ? [
                ...(role === "anonymous" ? [] : ["教学班订阅"]),
                "浏览教学班",
                "浏览课程",
                "教师",
              ]
            : [
                ...(role === "anonymous" ? [] : ["Section subscriptions"]),
                "Browse sections",
                "Browse courses",
                "Teachers",
              ],
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
        ).toHaveCount(role === "anonymous" ? 0 : 1);
        const allHubLinks = await hrefs(page, "[data-feature-hub] a");
        if (width < 768)
          await page
            .locator('[data-shell-topbar] [data-sidebar="trigger"]')
            .click();
        const navigation = page.locator(
          `[data-shell-navigation="${width < 768 ? "mobile" : "desktop"}"]`,
        );
        await expect(navigation).toHaveAttribute(
          "aria-label",
          locale === "zh-cn" ? "主导航" : "Primary navigation",
        );
        await expect(
          navigation.locator(
            '[data-slot="sidebar-group-label"][aria-expanded]',
          ),
        ).toHaveText(groupNames);
        for (const [label, expectedPaths] of [
          [
            copy.courses,
            [
              ...(role === "anonymous" ? [] : ["/workspace/subscriptions"]),
              "/catalog/sections",
              "/catalog/courses",
              "/catalog/teachers",
            ],
          ],
          [
            copy.activities,
            [
              "/catalog/young-events",
              ...(role === "anonymous"
                ? []
                : ["/workspace/subscriptions/activities?view=notifications"]),
            ],
          ],
        ] as const) {
          const group = navigation
            .locator('[data-slot="sidebar-group"]')
            .filter({
              has: page.getByRole("button", { name: label, exact: true }),
            });
          expect(
            await group
              .locator('a[data-sidebar="menu-button"]')
              .evaluateAll((nodes) =>
                nodes.map((node) => node.getAttribute("href")),
              ),
          ).toEqual(expectedPaths);
        }
        const collapsedGroups = navigation.locator(
          '[data-slot="sidebar-group-label"][aria-expanded="false"]',
        );
        const collapsedGroupCount = await collapsedGroups.count();
        for (let index = 0; index < collapsedGroupCount; index++)
          await collapsedGroups.first().click();
        const links = await navigation
          .locator(
            '[data-slot="sidebar-content"] a[data-sidebar="menu-button"]',
          )
          .evaluateAll((nodes) =>
            nodes.map((node) => node.getAttribute("href")).sort(),
          );
        expect(links).toEqual(expected);
        for (const href of links) expect(allHubLinks).toContain(href);
        if (width >= 768) desktopLinks = links;
        else expect(links).toEqual(desktopLinks);
        await expect(
          navigation.locator('[aria-current="page"]'),
        ).toHaveAttribute("href", "/");
        await expect(
          navigation.locator('a[href="/terms"], a[href="/privacy"]'),
        ).toHaveCount(0);
        await expect(
          navigation.locator('a[href^="/catalog/sections/"]'),
        ).toHaveCount(0);
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
          .getByRole("link", { name: "Life@USTC", exact: true })
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
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
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
