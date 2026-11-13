import { expect, type Page } from "@playwright/test";
import type { User } from "../../../../../src/generated/prisma-node/client";
import { test as workerTest } from "../../../utils/account-fixture";
import type { IsolatedWorker } from "../../../utils/isolated-worker";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../utils/page-ready";

// The footer scenario visits public content before explicitly signing in.
const test = workerTest.extend<{ shellUser: User }>({
  shellUser: async ({ isolatedWorker, run }, use) => {
    await use(
      await run(() =>
        isolatedWorker.database.owner.user.create({
          data: {
            name: "Shell policy user",
            username: `shell${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
            email: `shell-policy-${crypto.randomUUID()}@example.test`,
            isAdmin: true,
          },
        }),
      ),
    );
  },
});

async function signIn(page: Page, worker: IsolatedWorker, userId: string) {
  await page
    .context()
    .addCookies([(await worker.createSession(userId)).cookie]);
  expect(
    (
      await page.request.post("/api/account/preferences", {
        data: { locale: "en-us" },
      })
    ).status(),
  ).toBe(200);
}

test("ui.shell-layout-1", { tag: "@Site/Web" }, async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 400 });
  await gotoAndWaitForReady(page, "/terms");
  // Root4 is intentionally short. Keep the original desktop size as a
  // no-overflow check, then exercise real Campus content in a short viewport.
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(1440);
  const rootSidebar = page
    .getByTestId("app-sidebar")
    .locator('[data-slot="sidebar-content"]');
  expect(
    await rootSidebar.evaluate((node) => node.scrollHeight - node.clientHeight),
  ).toBeLessThanOrEqual(1);
  expect(await rootSidebar.evaluate((node) => node.scrollTop)).toBe(0);
  expect(
    await page
      .locator("[data-shell-scroll-container]")
      .evaluate((node) => node.scrollHeight - node.clientHeight),
  ).toBeGreaterThan(200);
  await page.setViewportSize({ width: 1440, height: 220 });
  await gotoAndWaitForReady(page, "/campus");
  const sidebar = page
    .getByTestId("app-sidebar")
    .locator('[data-slot="sidebar-content"]');
  const main = page.locator("[data-shell-scroll-container]");
  for (const pane of [sidebar, main]) {
    expect(
      await pane.evaluate(
        (element) => element.scrollHeight - element.clientHeight,
      ),
    ).toBeGreaterThan(200);
    expect(await pane.evaluate((element) => element.scrollTop)).toBe(0);
  }
  await sidebar.hover();
  await page.mouse.wheel(0, 300);
  await expect
    .poll(() => sidebar.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(100);
  expect(await main.evaluate((element) => element.scrollTop)).toBe(0);
  const sidebarPosition = await sidebar.evaluate(
    (element) => element.scrollTop,
  );
  await main.hover();
  await page.mouse.wheel(0, 350);
  await expect
    .poll(() => main.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(100);
  expect(await sidebar.evaluate((element) => element.scrollTop)).toBe(
    sidebarPosition,
  );
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await main.focus();
  await page.keyboard.press("Home");
  await expect
    .poll(() => main.evaluate((element) => element.scrollTop))
    .toBe(0);
  expect(await sidebar.evaluate((element) => element.scrollTop)).toBe(
    sidebarPosition,
  );
});

test("ui.shell-layout-5", { tag: "@Site/Web" }, async ({
  accountRun,
  page,
  shellUser,
  isolatedWorker,
}) => {
  await accountRun(
    { writes: [["/api/account/preferences", 200]], audits: [] },
    async () => {
      await signIn(page, isolatedWorker, shellUser.id);
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await gotoAndWaitForReady(page, "/workspace/todos");
        const topbar = page.locator("[data-shell-topbar]");
        for (const name of [/Language/, /Theme/]) {
          const control = topbar.getByRole("button", { name });
          await expect(control).toBeVisible();
          await control.focus();
          await page.keyboard.press("Enter");
          await expect(page.getByRole("menu")).toBeVisible();
          await expect(page.getByRole("menuitemradio").first()).toBeVisible();
          await page.keyboard.press("Escape");
          await expect(control).toBeFocused();
        }
        const profile = topbar.getByRole("button", {
          name: "Profile menu",
          exact: true,
        });
        await expect(profile).toHaveCount(1);
        await expect(page.locator("#app-user-menu:visible")).toHaveCount(1);
        await expect(
          page.locator(
            '[data-slot="sidebar-footer"] #app-user-menu, footer #app-user-menu',
          ),
        ).toHaveCount(0);
        await expect(profile).toBeVisible();
        await profile.focus();
        await page.keyboard.press("Enter");
        for (const name of [
          "Personal page",
          "Settings",
          "My Uploads",
          "Admin",
          "Sign Out",
        ])
          await expect(
            page.getByRole("menuitem", { name, exact: true }),
          ).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(profile).toBeFocused();
      }
    },
  );
});

test("ui.shell-layout-7", { tag: "@Site/Web" }, async ({ page }) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/catalog/courses", "/terms"]) {
      await gotoAndWaitForReady(page, path);
      const signIn = page
        .locator("[data-shell-topbar]")
        .getByRole("link", { name: /^(Sign in|登录)$/i });
      await expect(signIn).toBeVisible();
      await expect(signIn).toHaveAttribute("href", "/account/sign-in");
      await signIn.focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/account\/sign-in$/);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  }
});

test("ui.workspace-footer-policy-2", { tag: "@Site/Web" }, async ({
  accountRun,
  page,
  shellUser,
  isolatedWorker,
}) => {
  await accountRun(
    {
      writes: [["/api/account/preferences", 200]],
      audits: ["account_calendar_token_create"],
    },
    async () => {
      await gotoAndWaitForReady(page, "/terms");
      await expect(
        page.getByRole("navigation", { name: /Footer navigation|页脚导航/ }),
      ).toBeVisible();
      await signIn(page, isolatedWorker, shellUser.id);
      for (const path of [
        "/workspace/calendar",
        "/workspace/homeworks",
        "/workspace/todos",
        "/workspace/exams",
        "/workspace/subscriptions",
        "/account/settings/profile",
        "/account/settings/accounts",
        "/account/settings/preferences",
        "/account/settings/danger",
        "/admin/users",
        "/admin/moderation",
        "/admin/bus",
      ]) {
        await gotoAndWaitForReady(page, path);
        await expect(page).toHaveURL(new RegExp(`${path}$`));
        // The sidebar legal strip shares the landmark name with the public
        // footer. These templates keep the strip without appending a footer.
        await expect(page.locator("footer")).toHaveCount(0);
        const legal = page.locator("[data-shell-legal-nav]");
        await expect(
          legal.and(
            page.getByRole("navigation", {
              name: "Footer navigation",
              exact: true,
            }),
          ),
        ).toHaveCount(1);
        for (const href of ["/terms", "/privacy", "/usage/mobile"]) {
          await expect(legal.locator(`a[href="${href}"]`)).toBeVisible();
        }
        await expect(
          legal.getByRole("link", { name: "GitHub", exact: true }),
        ).toBeVisible();
      }
      await isolatedWorker.database.owner.user.update({
        where: { id: shellUser.id },
        data: { name: "", username: null },
      });
      await gotoAndWaitForReady(page, "/account/welcome");
      await expect(page).toHaveURL(/\/account\/welcome$/);
      await expect(
        page.getByRole("navigation", {
          name: "Footer navigation",
          exact: true,
        }),
      ).toHaveCount(0);
      return async () => {
        expect(await isolatedWorker.database.owner.user.findMany()).toEqual([
          {
            ...shellUser,
            name: "",
            username: null,
            calendarFeedToken: expect.any(String),
            updatedAt: expect.any(Date),
          },
        ]);
      };
    },
  );
});

test("ui.shell-layout-4", { tag: "@Site/Web" }, async ({
  accountRun,
  page,
  shellUser,
  isolatedWorker,
}) => {
  await accountRun(
    {
      writes: [["/api/account/preferences", 200]],
      audits: ["account_calendar_token_create"],
    },
    async () => {
      await signIn(page, isolatedWorker, shellUser.id);
      const cdp = await page.context().newCDPSession(page);
      try {
        await page.setViewportSize({ width: 390, height: 700 });
        await gotoAndWaitForReady(page, "/workspace/todos");
        const primary = page.locator("[data-mobile-primary-navigation]");
        await expect(primary).toBeVisible();
        await expect(primary.locator("a")).toHaveText([
          "Workspace",
          "Calendar",
          "Campus",
          "Activities",
        ]);
        const destinations = [
          ["Life@USTC: Home", "/"],
          ["Calendar", "/workspace/calendar"],
          ["Homework", "/workspace/homeworks"],
          ["Todos", "/workspace/todos"],
          ["Browse courses", "/catalog/courses"],
        ];
        for (const [label, href] of destinations) {
          await page
            .locator('[data-shell-topbar] [data-sidebar="trigger"]')
            .click();
          const navigation = page.locator('[data-shell-navigation="mobile"]');
          if (label === "Calendar") {
            await expect(navigation).toHaveAttribute(
              "data-shell-navigation-view",
              "workspace",
            );
            await navigation.locator("[data-local-navigation-back]").click();
          } else if (label === "Homework") {
            await expect(navigation).toHaveAttribute(
              "data-shell-navigation-view",
              "calendar",
            );
            await navigation.locator("[data-local-navigation-back]").click();
            await navigation
              .locator('[data-slot="sidebar-content"] a[href="/"]')
              .click();
            await expect(page).toHaveURL(`${isolatedWorker.origin}/`);
            await waitForUiSettled(page);
            await page
              .locator('[data-shell-topbar] [data-sidebar="trigger"]')
              .click();
          } else if (label === "Browse courses") {
            await expect(navigation).toHaveAttribute(
              "data-shell-navigation-view",
              "workspace",
            );
            await navigation.locator("[data-local-navigation-back]").click();
            await navigation.locator('a[href="/campus"]').click();
            await expect(page).toHaveURL(/\/campus$/);
            await waitForUiSettled(page);
            await page
              .locator('[data-shell-topbar] [data-sidebar="trigger"]')
              .click();
          }
          const link =
            label === "Life@USTC: Home"
              ? navigation.locator("#app-logo")
              : navigation.getByRole("link", { name: label, exact: true });
          await expect(link).toHaveAttribute("href", href);
          await link.focus();
          await page.keyboard.press("Enter");
          await expect(page).toHaveURL(new RegExp(`${href}$`));
          await expect(navigation).toBeHidden();
          await page
            .locator('[data-shell-topbar] [data-sidebar="trigger"]')
            .click();
          await expect(navigation.locator('[aria-current="page"]')).toHaveCount(
            1,
          );
          await expect(
            navigation.locator('[aria-current="page"]'),
          ).toHaveAttribute("href", href);
          await page.keyboard.press("Escape");
          await expect(navigation).toBeHidden();
        }
        await gotoAndWaitForReady(page, "/terms");
        const contentEnd = page
          .locator("[data-shell-scroll-container] p")
          .last();
        for (const inset of [0, 34]) {
          await cdp.send("Emulation.setSafeAreaInsetsOverride", {
            insets: { bottom: inset },
          });
          const footer = page.getByRole("contentinfo");
          await expect
            .poll(() =>
              footer.evaluate((element) =>
                Number.parseFloat(getComputedStyle(element).paddingBottom),
              ),
            )
            .toBe(0);
          expect(
            await page
              .locator('[data-slot="sidebar-wrapper"]')
              .evaluate((element) =>
                Number.parseFloat(getComputedStyle(element).paddingBottom),
              ),
          ).toBe(64 + inset);
          const primaryBox = await primary.boundingBox();
          if (!primaryBox) throw new Error("Missing mobile primary bounds");
          expect(primaryBox.height).toBe(64 + inset);
          expect(primaryBox.y + primaryBox.height).toBe(700);
          await page.evaluate(() =>
            window.scrollTo(0, document.documentElement.scrollHeight),
          );
          await expect(contentEnd).toBeInViewport();
          const endBox = await contentEnd.boundingBox();
          const footerBox = await footer.boundingBox();
          if (!endBox || !footerBox)
            throw new Error("Missing mobile content or footer bounds");
          expect(endBox.y + endBox.height).toBeLessThanOrEqual(footerBox.y);
          expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(
            primaryBox.y,
          );
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
          ).toBeLessThanOrEqual(390);
          await gotoAndWaitForReady(page, "/workspace/todos");
          expect(
            await page
              .locator("[data-shell-scroll-container] > div")
              .evaluate((element) =>
                Number.parseFloat(getComputedStyle(element).paddingBottom),
              ),
          ).toBe(16);
          expect(await primary.boundingBox()).toMatchObject({
            height: 64 + inset,
          });
          await gotoAndWaitForReady(page, "/terms");
        }
      } finally {
        await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: {} });
        await cdp.detach();
      }
      return async () => {
        expect(await isolatedWorker.database.owner.user.findMany()).toEqual([
          {
            ...shellUser,
            calendarFeedToken: expect.any(String),
            updatedAt: expect.any(Date),
          },
        ]);
      };
    },
  );
});

test("ui.navigation-landmarks-5", { tag: "@Site/Web" }, async ({ page }) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [href, name] of [
      ["/catalog/courses", /^(Browse courses|浏览课程)$/],
      ["/catalog/young-events", /^(Second Classroom|第二课堂)$/],
      ["/news", /^(News & Notices|新闻公告)$/],
    ] as const) {
      await gotoAndWaitForReady(page, "/");
      if (width < 768)
        await page
          .locator("[data-shell-topbar]")
          .getByRole("button", { name: /^(Menu|菜单)$/ })
          .click();
      const navigation = page.locator(
        `[data-shell-navigation="${width < 768 ? "mobile" : "desktop"}"]`,
      );
      if (href !== "/catalog/young-events") {
        await expect(navigation).toHaveAttribute(
          "data-shell-navigation-view",
          "root",
        );
        await navigation.locator('a[href="/campus"]').click();
        await expect(page).toHaveURL(/\/campus$/);
        await waitForUiSettled(page);
        if (width < 768)
          await page
            .locator('[data-shell-topbar] [data-sidebar="trigger"]')
            .click();
        await expect(navigation).toHaveAttribute(
          "data-shell-navigation-view",
          "campus",
        );
      }
      const link = navigation.getByRole("link", {
        name: href === "/catalog/young-events" ? /^(Activities|活动)$/ : name,
      });
      await expect(link).toHaveCount(1);
      await expect(link).toHaveAttribute("href", href);
      await link.click();
      await expect(page).toHaveURL(new RegExp(`${href}$`));
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  }
});

test("ui.shell-layout-3", { tag: "@Site/Web" }, async ({ page }) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await gotoAndWaitForReady(page, "/");
    if (width < 768)
      await page
        .locator("[data-shell-topbar]")
        .getByRole("button", { name: /^(Menu|菜单)$/ })
        .click();
    const navigation = page.locator(
      `[data-shell-navigation="${width < 768 ? "mobile" : "desktop"}"]`,
    );
    await expect(navigation).toHaveAttribute(
      "data-shell-navigation-view",
      "root",
    );
    const campus = navigation.getByRole("link", { name: /^(Campus|校园)$/ });
    await expect(campus).toHaveAttribute("href", "/campus");
    await expect(
      navigation.locator(
        'button[data-slot="sidebar-group-label"], [data-slot="sidebar-menu-action"]',
      ),
    ).toHaveCount(0);
    await expect(
      navigation
        .locator('[data-slot="sidebar-group-label"]')
        .filter({ hasText: /^\s*(Primary navigation|主导航)\s*$/ }),
    ).toBeVisible();
    await expect(campus).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    const rows = await navigation
      .locator('[data-slot="sidebar-content"] [data-sidebar="menu-button"]')
      .evaluateAll((elements) =>
        elements.map((element) => ({
          tag: element.tagName,
          href: element.getAttribute("href"),
          expanded: element.getAttribute("aria-expanded"),
        })),
      );
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.tag).toBe("A");
      expect(row.href).toMatch(/^\//);
      expect(row.expanded).toBeNull();
    }
    await expect(navigation.locator("a button, button a")).toHaveCount(0);
    await campus.click();
    await expect(page).toHaveURL(/\/campus$/);
    await waitForUiSettled(page);
    if (width < 768)
      await page
        .locator('[data-shell-topbar] [data-sidebar="trigger"]')
        .click();
    await expect(navigation).toHaveAttribute(
      "data-shell-navigation-view",
      "campus",
    );
    await expect(
      navigation.locator(
        '[data-slot="sidebar-content"] a[data-sidebar="menu-button"]',
      ),
    ).toHaveCount(8);
    await expect(
      navigation.locator('[data-slot="sidebar-menu-sub"]'),
    ).toHaveCount(0);
    const bus = navigation.getByRole("link", { name: /^(Shuttle Bus|校车)$/ });
    await bus.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/catalog\/bus$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});
