/**
 * E2E tests for /admin — Admin entry + primary navigation
 *
 * ## Features
 * - Admin-only: unauthenticated → /account/sign-in, non-admin → 403
 * - /admin redirects to /admin/users
 * - Admin tools live in the primary sidebar (no secondary admin nav)
 */
import { expect } from "@playwright/test";
import { test as adminTest } from "../../../utils/admin-fixture";
import { expectRequiresSignIn } from "../../../utils/auth";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { captureStepScreenshot } from "../../../utils/screenshot";

const test = adminTest.extend<{
  records: { user: string; comment: string; oauth: string; bus: string };
}>({
  records: async ({ isolatedWorker, admin: _admin }, use) => {
    const records = await isolatedWorker.database.owner.$transaction(
      async (db) => {
        const user = await db.user.create({
          data: {
            name: "Responsive managed user",
            username: "responsiveuser",
            email: "responsive@example.test",
            emailVerified: true,
          },
        });
        const course = await db.course.create({
          data: {
            jwId: 1,
            code: "RESP01",
            nameCn: "响应式审核课程",
            nameEn: "Responsive moderation course",
          },
        });
        const comment = await db.comment.create({
          data: {
            userId: user.id,
            courseId: course.id,
            body: "Responsive moderation record",
          },
        });
        await db.oAuthClient.create({
          data: {
            clientId: "responsive-client",
            name: "Responsive OAuth client",
            tokenEndpointAuthMethod: "none",
            type: "public",
            requirePKCE: true,
            scopes: ["openid"],
            redirectUris: [],
            grantTypes: ["authorization_code"],
            responseTypes: ["code"],
          },
        });
        const bus = await db.busScheduleVersion.create({
          data: {
            key: "responsive-bus",
            title: "Responsive inactive timetable",
            checksum: "responsive-bus",
            rawJson: {},
            isEnabled: false,
          },
        });
        return {
          user: user.name,
          comment: comment.body,
          oauth: "Responsive OAuth client",
          bus: bus.title,
        };
      },
    );
    await use(records);
  },
});

function adminPrimaryNav(page: import("@playwright/test").Page) {
  return page.getByTestId("app-sidebar").getByRole("navigation", {
    name: /主导航|Primary navigation/i,
  });
}

test("/admin 未登录重定向到登录页", async ({ page }, testInfo) => {
  await expectRequiresSignIn(page, "/admin", {
    providers: ["ustc", "github", "google"],
  });
  await captureStepScreenshot(page, testInfo, "admin/unauthorized");
});

test("/admin 普通用户访问返回 403", async ({
  page,
  account: _account,
}, testInfo) => {
  await gotoAndWaitForReady(page, "/admin");
  await expect(page.locator("h1")).toHaveText("403");
  await captureStepScreenshot(page, testInfo, "admin/403");
});

test("/admin 重定向到用户管理", async ({ page, admin: _admin }, testInfo) => {
  await gotoAndWaitForReady(page, "/admin");
  await expect(page).toHaveURL(/\/admin\/users(?:\?.*)?$/);
  await expect(page.getByTestId("admin-workspace")).toBeVisible();
  await captureStepScreenshot(page, testInfo, "admin/redirect-users");
});

test("已移除的可观测性页面返回 404 且不出现在管理导航", async ({
  page,
  admin: _admin,
}) => {
  await gotoAndWaitForReady(page, "/admin/users");

  for (const path of ["/admin/analytics", "/admin/audit"] as const) {
    await expect((await page.request.get(path)).status()).toBe(404);
  }

  const navigation = adminPrimaryNav(page);
  await expect(navigation.locator('a[href="/admin/analytics"]')).toHaveCount(0);
  await expect(navigation.locator('a[href="/admin/audit"]')).toHaveCount(0);
});

test("admin.primary-admin-navigation", async ({
  page,
  admin: _admin,
}, testInfo) => {
  await gotoAndWaitForReady(page, "/admin");
  await expect(page).toHaveURL(/\/admin\/users(?:\?.*)?$/);

  const paths = [
    { path: "/admin/users", name: /用户管理|User Management/i },
    { path: "/admin/moderation", name: /内容审核|Moderation/i },
    { path: "/admin/oauth", name: /OAuth|OAuth 客户端/i },
    { path: "/admin/bus", name: /校车管理|Bus Management/i },
  ] as const;

  for (const { path, name } of paths) {
    await gotoAndWaitForReady(page, path, {
      browserHealth: {},
      expectMeaningfulContent: true,
      expectNoHorizontalOverflow: true,
    });

    const navigation = adminPrimaryNav(page);
    const adminLinks = navigation.locator('a[href^="/admin"]');
    await expect(adminLinks).toHaveCount(4);
    await expect(navigation.getByRole("link", { name })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(navigation.locator('a[aria-current="page"]')).toHaveCount(1);
    await expect(
      page.locator("#main-content").getByRole("heading", { level: 1 }),
    ).toHaveCount(1);
  }

  await expect(page.getByTestId("admin-navigation")).toHaveCount(0);
  await captureStepScreenshot(page, testInfo, "admin/primary-navigation");
});

test("/admin 主导航支持键盘切换", async ({ page, admin: _admin }, testInfo) => {
  await gotoAndWaitForReady(page, "/admin/oauth");

  const navigation = adminPrimaryNav(page);
  const moderationLink = navigation.getByRole("link", {
    name: /内容审核|Moderation/i,
  });
  await expect(navigation.locator('a[aria-current="page"]')).toHaveAttribute(
    "href",
    "/admin/oauth",
  );
  await moderationLink.focus();
  await expect(moderationLink).toBeFocused();
  await moderationLink.press("Enter");
  await expect(page).toHaveURL(/\/admin\/moderation(?:\?.*)?$/);
  await expect(navigation.locator('a[aria-current="page"]')).toHaveAttribute(
    "href",
    "/admin/moderation",
  );
  await captureStepScreenshot(page, testInfo, "admin/navigation-keyboard");
});

test("/admin 主导航可跳转到各管理工具", async ({
  page,
  admin: _admin,
}, testInfo) => {
  await gotoAndWaitForReady(page, "/admin/users");

  const navigation = adminPrimaryNav(page);
  const hops = [
    {
      name: /内容审核|Moderation/i,
      url: /\/admin\/moderation(?:\?.*)?$/,
      shot: "admin/navigate-moderation",
    },
    {
      name: /OAuth|OAuth 客户端/i,
      url: /\/admin\/oauth(?:\?.*)?$/,
      shot: "admin/navigate-oauth",
    },
    {
      name: /校车管理|Bus Management/i,
      url: /\/admin\/bus(?:\?.*)?$/,
      shot: "admin/navigate-bus",
    },
    {
      name: /用户管理|User Management/i,
      url: /\/admin\/users(?:\?.*)?$/,
      shot: "admin/navigate-users",
    },
  ] as const;

  for (const { name, url, shot } of hops) {
    const link = navigation.getByRole("link", { name });
    await expect(link).toBeVisible();
    await Promise.all([page.waitForURL(url), link.click()]);
    await captureStepScreenshot(page, testInfo, shot);
  }
});

test("/admin 移动端导航覆盖全部管理工具且显示当前位置", async ({
  page,
  admin: _admin,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await gotoAndWaitForReady(page, "/admin/users");

  const paths = [
    { path: "/admin/users", name: /用户管理|User Management/i },
    { path: "/admin/moderation", name: /内容审核|Moderation/i },
    { path: "/admin/oauth", name: /OAuth|OAuth 客户端/i },
    { path: "/admin/bus", name: /校车管理|Bus Management/i },
  ] as const;

  const mobileNavigation = page.getByTestId("admin-mobile-navigation");
  await expect(mobileNavigation).toBeVisible();
  await expect(page.getByTestId("mobile-primary-navigation")).toHaveCount(0);

  for (const { path, name } of paths) {
    await gotoAndWaitForReady(page, path);
    await expect(
      mobileNavigation.getByTestId("admin-mobile-navigation-current"),
    ).toContainText(name);

    await mobileNavigation
      .getByTestId("admin-mobile-navigation-trigger")
      .click();
    const panel = page.getByTestId("admin-mobile-navigation-panel");
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("link", { name })).toBeVisible();
    await expect(panel.getByRole("link", { name: /./ })).toHaveCount(4);
    await panel.getByRole("link", { name }).click();
    await expect(page).toHaveURL(new RegExp(`${path}(?:\\?.*)?$`));
  }
});

test("页面契约", async ({ page, admin: _admin }, testInfo) => {
  const response = await gotoAndWaitForReady(page, "/admin", {
    browserHealth: {},
    expectMeaningfulContent: true,
    expectNoHorizontalOverflow: true,
    uiQuality: {},
    testInfo,
  });
  expect(response?.ok()).toBe(true);
  await expect(page).toHaveURL(/\/admin\/users(?:\?.*)?$/);
  await expect(page.locator("#main-content")).toBeVisible();
  for (const name of [
    /用户管理|User Management/i,
    /内容审核|Moderation/i,
    /OAuth|OAuth 客户端/i,
    /校车管理|Bus Management/i,
  ]) {
    await expect(page.getByRole("link", { name })).toBeVisible();
  }
});

test("admin.responsive-workspace", async ({ page, records }, testInfo) => {
  // Expectations are specified independently of either rendered layout.
  const entries = [
    {
      path: "/admin/users",
      mobile: "admin-users-mobile-list",
      heading: /用户管理|User Management|用户列表|Users/i,
      identity: records.user,
      actions: [/^管理用户$|^Manage User$/i],
      filters: true,
    },
    {
      path: "/admin/moderation",
      mobile: "admin-moderation-mobile-list",
      heading: /内容审核|Moderation/i,
      identity: records.comment,
      actions: [/^管理评论$|^Manage Comment$/i],
      filters: true,
    },
    {
      path: "/admin/oauth",
      mobile: null,
      heading: /OAuth 客户端管理|OAuth Clients/i,
      identity: records.oauth,
      actions: [/^(删除|Delete): Responsive OAuth client$/i],
      filters: false,
    },
    {
      path: "/admin/bus",
      mobile: "admin-bus-mobile-list",
      heading: /校车管理|Bus Management/i,
      identity: records.bus,
      actions: [
        /^(激活版本|Activate version)$/i,
        /^(删除版本|Delete version)$/i,
      ],
      filters: false,
    },
  ];
  for (const entry of entries) {
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ]) {
      const desktop = viewport.width === 1440;
      await page.setViewportSize(viewport);
      await gotoAndWaitForReady(page, entry.path, {
        browserHealth: {},
        expectMeaningfulContent: true,
        expectNoHorizontalOverflow: true,
      });
      const heading = page.getByRole("heading", {
        level: 1,
        name: entry.heading,
      });
      await expect(heading).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.locator("table:visible")).toHaveCount(desktop ? 1 : 0);
      const record = (
        desktop
          ? page.locator("tbody tr:visible")
          : entry.mobile
            ? page.getByTestId(entry.mobile).locator('[data-slot="item"]')
            : page.getByRole("listitem")
      ).filter({ hasText: entry.identity });
      await expect(record).toHaveCount(1);
      await expect(record).toBeVisible();
      const identity = record
        .getByText(entry.identity, { exact: true })
        .filter({ visible: true });
      await expect(identity).toBeVisible();
      await expect(record.getByRole("button")).toHaveCount(
        entry.actions.length,
      );
      for (const name of entry.actions)
        await expect(record.getByRole("button", { name })).toBeVisible();
      const titleGeometry = await heading.evaluate((node) => ({
        bottom: node.getBoundingClientRect().bottom,
        fontSize: parseFloat(getComputedStyle(node).fontSize),
      }));
      const recordGeometry = await identity.evaluate((node) => ({
        top: node.getBoundingClientRect().top,
        fontSize: parseFloat(getComputedStyle(node).fontSize),
      }));
      expect(titleGeometry.bottom).toBeLessThanOrEqual(recordGeometry.top);
      expect(titleGeometry.fontSize).toBeGreaterThan(recordGeometry.fontSize);
      if (entry.filters) {
        const search = page.getByRole("searchbox");
        await expect(search).toBeVisible();
        const filterGeometry = await search.evaluate((node) => ({
          top: node.getBoundingClientRect().top,
          bottom: node.getBoundingClientRect().bottom,
        }));
        expect(titleGeometry.bottom).toBeLessThanOrEqual(filterGeometry.top);
        expect(filterGeometry.bottom).toBeLessThanOrEqual(recordGeometry.top);
      }
      await captureStepScreenshot(
        page,
        testInfo,
        `admin-responsive-${desktop ? "desktop" : "mobile"}-${entry.path.split("/").at(-1)}`,
      );
    }
  }
});
