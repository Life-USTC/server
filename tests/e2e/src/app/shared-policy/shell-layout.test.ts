import { expect, type Page } from "@playwright/test";
import type { User } from "../../../../../src/generated/prisma-node/client";
import { test as workerTest } from "../../../utils/account-fixture";
import type { IsolatedWorker } from "../../../utils/isolated-worker";
import { gotoAndWaitForReady } from "../../../utils/page-ready";

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
        await expect(
          topbar.getByRole("button", { name: "Profile menu" }),
        ).toHaveCount(0);
        if (width < 768)
          await topbar
            .getByRole("button", { name: "Menu", exact: true })
            .click();
        const shell =
          width < 768
            ? page.getByRole("dialog", { name: "Sidebar", exact: true })
            : page.getByTestId("app-sidebar");
        const profile = shell
          .locator('[data-slot="sidebar-footer"]')
          .getByRole("button", { name: "Profile menu", exact: true });
        await expect(profile).toBeVisible();
        await profile.focus();
        await page.keyboard.press("Enter");
        for (const name of ["Personal page", "Settings", "Sign Out"])
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
        "/workspace/overview",
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
        await expect(
          page.getByRole("navigation", {
            name: "Footer navigation",
            exact: true,
          }),
        ).toHaveCount(0);
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
        const navigation = page.locator(
          '[data-shell-navigation="mobile-primary"]',
        );
        const destinations = [
          ["Today", "/workspace/overview"],
          ["Calendar", "/workspace/calendar"],
          ["Tasks", "/workspace/homeworks"],
          ["Explore", "/catalog/courses"],
        ];
        await expect(navigation.getByRole("link")).toHaveText(
          destinations.map(([label]) => label),
        );
        for (const [label, href] of destinations) {
          const link = navigation.getByRole("link", {
            name: label,
            exact: true,
          });
          await expect(link).toHaveAttribute("href", href);
          await link.focus();
          await page.keyboard.press("Enter");
          await expect(page).toHaveURL(new RegExp(`${href}$`));
          await expect(link).toHaveAttribute("aria-current", "page");
        }
        await gotoAndWaitForReady(page, "/terms");
        const contentEnd = page
          .locator("[data-shell-scroll-container] p")
          .last();
        for (const inset of [0, 34]) {
          await cdp.send("Emulation.setSafeAreaInsetsOverride", {
            insets: { bottom: inset },
          });
          await expect
            .poll(() =>
              navigation.evaluate((element) =>
                Number.parseFloat(getComputedStyle(element).paddingBottom),
              ),
            )
            .toBe(inset);
          const height = await navigation.evaluate(
            (element) => element.getBoundingClientRect().height,
          );
          expect(height).toBe(57 + inset);
          const padding = await page
            .locator('[data-slot="sidebar-wrapper"]')
            .evaluate((element) =>
              Number.parseFloat(getComputedStyle(element).paddingBottom),
            );
          expect(padding).toBe(56 + inset);
          await page.evaluate(() =>
            window.scrollTo(0, document.documentElement.scrollHeight),
          );
          await expect(contentEnd).toBeInViewport();
          const endBox = await contentEnd.boundingBox();
          const navigationBox = await navigation.boundingBox();
          expect(endBox).not.toBeNull();
          expect(navigationBox).not.toBeNull();
          if (!endBox || !navigationBox)
            throw new Error("Missing mobile content or navigation bounds");
          expect(endBox.y + endBox.height).toBeLessThanOrEqual(navigationBox.y);
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
          ).toBeLessThanOrEqual(390);
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
      ["/catalog/courses", /^(Courses|课程)$/],
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
        `[data-shell-navigation="${width < 768 ? "secondary" : "desktop"}"]`,
      );
      const link = navigation.getByRole("link", { name });
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
      `[data-shell-navigation="${width < 768 ? "secondary" : "desktop"}"]`,
    );
    const campusGroup = navigation.getByRole("button", {
      name: /^(Campus services|校园服务)$/i,
    });
    const courses = navigation.getByRole("link", { name: /^(Courses|课程)$/ });
    await expect(campusGroup).toHaveAttribute("aria-expanded", "true");
    expect(await campusGroup.getAttribute("href")).toBeNull();
    await campusGroup.focus();
    await page.keyboard.press("Enter");
    await expect(campusGroup).toHaveAttribute("aria-expanded", "false");
    await expect(courses).toBeHidden();
    await expect(page).toHaveURL(/\/$/);
    await page.keyboard.press("Enter");
    await expect(campusGroup).toHaveAttribute("aria-expanded", "true");
    await expect(courses).toBeVisible();
    const rows = await navigation
      .locator('[data-sidebar="menu-button"]')
      .evaluateAll((elements) =>
        elements.map((element) => ({
          tag: element.tagName,
          href: element.getAttribute("href"),
          expanded: element.getAttribute("aria-expanded"),
        })),
      );
    expect(rows.length).toBeGreaterThan(10);
    for (const row of rows) {
      expect(row.tag).toBe("A");
      expect(row.href).toMatch(/^\//);
      expect(row.expanded).toBeNull();
    }
    await expect(navigation.locator("a button, button a")).toHaveCount(0);
    const bus = navigation.getByRole("link", { name: /^(Shuttle Bus|校车)$/ });
    await bus.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/catalog\/bus$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});
