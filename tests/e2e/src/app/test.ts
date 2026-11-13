import { expect } from "@playwright/test";
import { gotoAndWaitForReady, waitForUiSettled } from "../../utils/page-ready";
import { test } from "../../utils/public-worker";
import { test as shellTest } from "../../utils/shell-fixture";
import { assertPageContract } from "./_shared/page-contract";

test("anonymous landing and keyboard access", { tag: "@Site/Web" }, async ({
  publicFlow,
  page,
}) => {
  await publicFlow.run(async () => {
    await test.step("ui.navigation-landmarks-4", async () => {
      await gotoAndWaitForReady(page, "/");

      await page.keyboard.press("Tab");
      const skipLink = page.getByRole("link", {
        name: /跳转到主要内容|Skip to main content/i,
      });
      await expect(skipLink).toBeFocused();
      await expect(skipLink).toBeVisible();
      await expect(skipLink).toHaveCSS("position", "fixed");
      await page.keyboard.press("Enter");
      await expect(page.locator("#main-content")).toBeFocused();
      await publicFlow.assertAnonymousNoEffects();
    });
    await test.step("/", async () => {
      await assertPageContract(page, { routePath: "/" });
      await publicFlow.assertAnonymousNoEffects();
    });
    await test.step("/ 首页快速入口可见", async () => {
      await gotoAndWaitForReady(page, "/");

      await expect(page.locator("#app-logo")).toBeVisible();
      await expect(page.locator("#app-user-menu")).toHaveCount(0);
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: /总览|Overview/i,
        }),
      ).toBeVisible();
      const main = page.locator("#main-content");
      await expect(
        main.getByRole("link", { name: /^(课程|Courses)$/i }),
      ).toBeVisible();
      // Bus and links are independent public destinations in the shell.
      await expect(
        main.getByRole("link", { name: /^(校车|Bus)$/i }),
      ).toBeVisible();
      await expect(
        main.getByRole("link", { name: /^(网站|Websites)$/i }),
      ).toBeVisible();
      await expect(
        main.locator('a[href="/account/sign-in"]').first(),
      ).toBeVisible();
      await expect(page.getByTestId("bus-compact-summary")).toHaveCount(0);
      await publicFlow.assertAnonymousNoEffects();
    });
    await test.step("仪表盘 › 无效 tab 不再选择其他公共资源", async () => {
      await gotoAndWaitForReady(page, "/?tab=unknown");

      await expect(page).toHaveURL(/\/\?tab=unknown$/);
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: /总览|Overview/i,
        }),
      ).toBeVisible();
      await expect(page.getByTestId("bus-compact-summary")).toHaveCount(0);
      await publicFlow.assertAnonymousNoEffects();
    });
  }, {});
});

shellTest(
  "/ 登录用户的旧 tab 永久重定向至语义 workspace 路径",
  { tag: "@Site/Web" },
  async ({ communityFlow, page, account: _account }) => {
    await communityFlow.run(async () => {
      await gotoAndWaitForReady(page, "/workspace");

      const response = await page.request.get(
        "/?tab=calendar&calendarView=week&calendarSemester=42&utm_source=ignored",
        { maxRedirects: 0 },
      );

      expect(response.status()).toBe(308);
      expect(response.headers().location).toBe(
        "/workspace/calendar?calendarView=week&calendarSemester=42&utm_source=ignored",
      );
    }, {});
  },
);

test("/ shell 匿名 390px 抽屉只展示公开导航", { tag: "@Site/Web" }, async ({
  publicFlow,
  page,
}) => {
  await publicFlow.run(async () => {
    const browserIssues: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        browserIssues.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) =>
      browserIssues.push(`pageerror: ${error.message}`),
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndWaitForReady(page, "/");

    const topbar = page.locator("[data-shell-topbar]");
    for (const button of [
      topbar.getByRole("button", { name: /^菜单$|^Menu$/i }),
      topbar.getByRole("button", { name: /语言|Language/i }),
      topbar.getByRole("button", { name: /主题|Theme/i }),
    ]) {
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    await expect(
      topbar.getByRole("link", { name: /^(登录|Sign in)$/i }),
    ).toBeVisible();
    await topbar.getByRole("button", { name: /^菜单$|^Menu$/i }).click();

    const sidebar = page.getByRole("dialog", {
      name: /^(Primary navigation|主导航|Workspace|工作台|Calendar|日历|Settings|设置|Activities|活动|Admin|管理后台)$/,
    });
    await expect(
      sidebar.getByRole("button", { name: /语言|Language/i }),
    ).toHaveCount(0);
    await expect(
      sidebar.getByRole("button", { name: /主题|Theme/i }),
    ).toHaveCount(0);
    await expect(
      sidebar.getByRole("button", { name: /个人菜单|Profile menu/i }),
    ).toHaveCount(0);
    const rootNav = sidebar.locator('[data-shell-navigation="mobile"]');
    expect(
      await rootNav
        .locator('[data-slot="sidebar-content"] a')
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href"))),
    ).toEqual([
      "/",
      "/account/sign-in?callbackUrl=%2Fworkspace%2Fcalendar",
      "/campus",
      "/catalog/young-events",
    ]);
    await expect(
      rootNav.locator(
        '[data-shell-count-value],a[href^="/admin"],a[href="/workspace/todos"]',
      ),
    ).toHaveCount(0);
    await rootNav.locator('a[href="/campus"]').click();
    await expect(page).toHaveURL(/\/campus$/);
    await topbar.getByRole("button", { name: /^菜单$|^Menu$/i }).click();
    const campus = page.getByRole("dialog", { name: /^(Campus|校园)$/ });
    for (const href of [
      "/catalog/bus",
      "/catalog/links",
      "/catalog/courses",
      "/catalog/sections",
      "/catalog/teachers",
    ])
      await expect(campus.locator(`a[href="${href}"]`)).toBeVisible();
    await expect(
      campus.locator(
        'a[href^="/workspace"],a[href^="/account"],a[href^="/admin"]',
      ),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(
      topbar.getByRole("button", { name: /^菜单$|^Menu$/i }),
    ).toBeFocused();
    await gotoAndWaitForReady(page, "/");
    for (const href of [
      "/usage/mobile",
      "/usage/bot",
      "/usage/mcp",
      "/usage/cli",
    ])
      await expect(
        page.locator(`[data-feature-directory] a[href="${href}"]`),
      ).toBeVisible();
    expect(browserIssues).toEqual([]);
  }, {});
});

test("ui.theme-system-response", { tag: "@Site/Web" }, async ({
  publicFlow,
  page,
}) => {
  await publicFlow.run(async () => {
    await gotoAndWaitForReady(page, "/");

    const themeButton = page.getByRole("button", {
      name: /^(主题选择|Theme selector)$/i,
    });
    await expect(themeButton).toBeVisible();

    async function selectTheme(
      name: RegExp,
      value: "light" | "dark" | "system",
    ) {
      const menuItem = page.getByRole("menuitemradio", { name });

      await expect(async () => {
        if ((await themeButton.getAttribute("aria-expanded")) !== "true") {
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
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await selectTheme(/^(深色|Dark)$/i, "dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.emulateMedia({ colorScheme: "dark" });
    await selectTheme(/^(跟随系统|System)$/i, "system");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  }, {});
});

test("ui.shell-layout-9", { tag: "@Site/Web" }, async ({
  publicFlow,
  baseURL,
}) => {
  await publicFlow.run(async () => {
    const context = await publicFlow.newContext({
      baseURL,
      colorScheme: "light",
    });
    try {
      await context.addInitScript(() => {
        localStorage.setItem("life-ustc-theme", "dark");
      });
      const page = await context.newPage();
      await publicFlow.route(
        page,
        "**/_app/immutable/**/*.js",
        async (route) => {
          publicFlow.expectReadCancellation(page, route.request());
          await route.abort("aborted");
        },
      );

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
    } finally {
      await publicFlow.closeContext(context);
    }
  }, {});
});

test("/ 浏览器存储不可用时仍完成 hydration 并允许切换主题", {
  tag: "@Site/Web",
}, async ({ publicFlow, baseURL }) => {
  await publicFlow.run(async () => {
    const context = await publicFlow.newContext({
      baseURL,
      colorScheme: "light",
    });
    try {
      await context.addInitScript(() => {
        Storage.prototype.getItem = () => {
          throw new DOMException("Storage disabled", "SecurityError");
        };
        Storage.prototype.setItem = () => {
          throw new DOMException("Storage disabled", "SecurityError");
        };
      });
      const page = await context.newPage();
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));

      await gotoAndWaitForReady(page, "/");
      await page
        .getByRole("button", { name: /^(主题选择|Theme selector)$/i })
        .click();
      await page.getByRole("menuitemradio", { name: /^(深色|Dark)$/i }).click();

      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      expect(pageErrors).toEqual([]);
    } finally {
      await publicFlow.closeContext(context);
    }
  }, {});
});

test("ui.theme-no-js", { tag: "@Site/Web" }, async ({
  publicFlow,
  baseURL,
}) => {
  await publicFlow.run(async () => {
    const context = await publicFlow.newContext({
      baseURL,
      colorScheme: "dark",
      javaScriptEnabled: false,
    });
    try {
      const page = await context.newPage();

      const response = await page.goto("/", { waitUntil: "domcontentloaded" });

      expect(response?.status()).toBe(200);
      await expect(page.locator("#main-content")).toBeVisible();
      await expect(page.locator("html")).not.toHaveAttribute(
        "data-theme",
        /.+/,
      );
      // DOMContentLoaded can precede stylesheet application when scripts are disabled.
      await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
    } finally {
      await publicFlow.closeContext(context);
    }
  }, {});
});

shellTest(
  "/ shell 只保留滚动区域的顺序焦点",
  { tag: "@Site/Web" },
  async ({ communityFlow, page, account: _account }) => {
    await communityFlow.run(async () => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await gotoAndWaitForReady(page, "/workspace/todos");

      const main = page.locator("#main-content");
      const scrollRegion = page.locator("[data-shell-scroll-container]");
      await expect(main).toHaveAttribute("tabindex", "-1");
      await expect(scrollRegion).toHaveAttribute("tabindex", "0");
      await expect(scrollRegion).toHaveRole("region");

      const labels = await Promise.all([
        main.getAttribute("aria-label"),
        scrollRegion.getAttribute("aria-label"),
      ]);
      expect(labels[1]).toBeTruthy();
      expect(labels[0]).not.toBe(labels[1]);

      const skipLink = page.getByRole("link", {
        name: /跳转到主要内容|Skip to main content/i,
      });
      await page.keyboard.press("Tab");
      await expect(skipLink).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(main).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(main).not.toBeFocused();
    }, {});
  },
);

shellTest(
  "/ shell 菜单可一键切换",
  { tag: "@Site/Web" },
  async ({ communityFlow, page, account: _account }) => {
    await communityFlow.run(async () => {
      await page.setViewportSize({ width: 390, height: 800 });
      await gotoAndWaitForReady(page, "/workspace/overview");

      const sidebarTrigger = page.getByRole("button", {
        name: /^菜单$|^Menu$/i,
      });
      await expect(sidebarTrigger).toHaveAttribute("aria-expanded", "false");
      await sidebarTrigger.click();
      await expect(sidebarTrigger).toHaveAttribute("aria-expanded", "true");

      const sidebar = page.getByRole("dialog", {
        name: /^(Primary navigation|主导航|Workspace|工作台|Calendar|日历|Settings|设置|Activities|活动|Admin|管理后台)$/,
      });
      await expect(sidebar).toBeVisible();
      await expect(
        sidebar.getByRole("link", { name: /^(待办|Todos)$/i }),
      ).toBeVisible();
      await expect(
        sidebar.locator('[data-slot="sidebar-menu-sub"],#app-user-menu'),
      ).toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(sidebarTrigger).toBeFocused();
      const accountMenuButton = page
        .locator("[data-shell-topbar] #app-user-menu")
        .getByRole("button");
      await accountMenuButton.click();
      await expect(
        page.getByRole("menuitem", { name: /设置|Settings/i }),
      ).toBeVisible();
    }, {});
  },
);

shellTest(
  "ui.shell-layout-2",
  { tag: "@Site/Web" },
  async ({ communityFlow, page, account: _account }) => {
    await communityFlow.run(
      async () => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await gotoAndWaitForReady(page, "/workspace/calendar");

        const sidebar = page.getByTestId("app-sidebar");
        const navigation = sidebar.locator('[data-shell-navigation="desktop"]');
        await expect(navigation).toHaveAttribute(
          "data-shell-navigation-view",
          "calendar",
        );
        await expect(
          navigation.locator('[data-slot="sidebar-content"] a'),
        ).toHaveCount(1);
        await expect(
          navigation.getByRole("link", { name: /^(日历|Calendar)$/i }),
        ).toHaveAttribute("aria-current", "page");
        await expect(navigation.locator('[aria-current="page"]')).toHaveCount(
          1,
        );
        await expect(
          navigation.locator(
            '[data-slot="sidebar-menu-sub"],button[aria-expanded]',
          ),
        ).toHaveCount(0);
        await expect(
          navigation.getByRole("link", {
            name: /^Life@USTC: (Home|首页)$/,
            exact: true,
          }),
        ).toHaveAttribute("href", "/");
        await page.getByTestId("calendar-sidebar-back").click();
        expect(
          await navigation
            .locator('[data-slot="sidebar-content"] a')
            .evaluateAll((nodes) =>
              nodes.map((node) => node.getAttribute("href")),
            ),
        ).toEqual([
          "/",
          "/workspace/calendar",
          "/campus",
          "/catalog/young-events",
        ]);
        await navigation
          .locator('[data-slot="sidebar-content"] a[href="/"]')
          .click();
        await expect(page).toHaveURL(/\/$/);
        for (const href of [
          "/workspace/homeworks",
          "/workspace/todos",
          "/workspace/exams",
          "/workspace/subscriptions",
          "/workspace/subscriptions/activities?view=notifications",
        ])
          await expect(navigation.locator(`a[href="${href}"]`)).toBeVisible();
        await expect(
          navigation.locator(
            'a[href="/workspace/uploads"],a[href^="/account"],a[href^="/admin"]',
          ),
        ).toHaveCount(0);
        await page.getByTestId("workspace-sidebar-back").click();
        await navigation.locator('a[href="/campus"]').click();
        await expect(page).toHaveURL(/\/campus$/);
        await expect(
          navigation.getByRole("link", {
            name: /^(浏览课程|Browse courses)$/i,
          }),
        ).toBeVisible();
        await expect(navigation.locator('a[href^="/workspace"]')).toHaveCount(
          0,
        );
      },
      { calendarTokenCreated: true },
    );
  },
);

shellTest(
  "/ shell 中等视口保留顶栏品牌并采用 stock 宽度",
  { tag: "@Site/Web" },
  async ({ communityFlow, page, account: _account }) => {
    await communityFlow.run(async () => {
      await page.setViewportSize({ width: 900, height: 800 });
      await gotoAndWaitForReady(page, "/workspace/overview");

      await expect(page.locator("#app-logo")).toBeVisible();
      // #1077 / shell hub: topbar brand stays through the tablet range
      // (hidden only at lg+); sidebar brand remains as well.
      await expect(
        page.locator("[data-shell-topbar] [data-shell-brand]"),
      ).toBeVisible();
      await expect
        .poll(() =>
          page.locator('[data-slot="sidebar-wrapper"]').evaluate((element) => {
            const style = getComputedStyle(element);
            return [
              style.getPropertyValue("--sidebar-width").trim(),
              style.getPropertyValue("--sidebar-width-icon").trim(),
            ];
          }),
        )
        .toEqual(["16rem", "3rem"]);

      const topbar = page.locator("[data-shell-topbar]");
      await expect(
        topbar.getByRole("button", { name: /语言|Language/i }),
      ).toBeVisible();
      await expect(
        topbar.getByRole("button", { name: /主题|Theme/i }),
      ).toBeVisible();

      const sidebar = page.getByTestId("app-sidebar");
      await expect(
        sidebar.getByRole("button", { name: /个人菜单|Profile menu/i }),
      ).toHaveCount(0);
      await expect(
        topbar.getByRole("button", { name: /个人菜单|Profile menu/i }),
      ).toBeVisible();
      await expect(
        sidebar.getByRole("button", { name: /语言|Language/i }),
      ).toHaveCount(0);
      await expect(
        sidebar.getByRole("button", { name: /主题|Theme/i }),
      ).toHaveCount(0);

      const menuTrigger = page
        .locator("[data-shell-topbar]")
        .getByRole("button", { name: /^菜单$|^Menu$/i });

      // The trigger must remain visible (not hidden at the `md` breakpoint) and
      // must be part of the tab order, not merely present in the DOM.
      await expect(menuTrigger).toBeVisible();
      await expect(menuTrigger).toHaveJSProperty("tabIndex", 0);

      const sidebarRoot = page.locator('[data-slot="sidebar"]');
      await expect(sidebarRoot).toHaveAttribute("data-state", "collapsed");
      await expect(sidebarRoot).toHaveAttribute("data-collapsible", "icon");

      const coursesLink = sidebar.locator('a[href="/workspace/todos"]');
      await expect(coursesLink).toBeVisible();
      await expect(coursesLink).toHaveAccessibleName(/^(待办|Todos)$/i);
      await expect(
        sidebar.locator(
          'button[data-shell-expand-sidebar],[data-slot="sidebar-menu-sub"]',
        ),
      ).toHaveCount(0);
      await expect
        .poll(async () => (await coursesLink.boundingBox())?.width ?? 0)
        .toBeLessThan(40);

      // Reach the trigger purely via the keyboard and activate it with Enter.
      await menuTrigger.focus();
      await expect(menuTrigger).toBeFocused();
      await page.keyboard.press("Enter");

      await expect(sidebarRoot).toHaveAttribute("data-state", "expanded");
      await expect(sidebarRoot).not.toHaveAttribute("data-collapsible", "icon");
      await expect(menuTrigger).toHaveAttribute("aria-expanded", "true");
      await expect(coursesLink).toBeVisible();
      // The sidebar width animates via a CSS transition, so poll until it settles
      // instead of asserting on a single synchronous measurement.
      await expect
        .poll(async () => (await coursesLink.boundingBox())?.width ?? 0)
        .toBeGreaterThan(100);

      // Space must also operate the control per standard button semantics.
      await menuTrigger.focus();
      await page.keyboard.press("Space");
      await expect(sidebarRoot).toHaveAttribute("data-state", "collapsed");
      await expect(menuTrigger).toHaveAttribute("aria-expanded", "false");

      const rail = page.locator('[data-sidebar="rail"]');
      await expect(rail).toHaveJSProperty("tabIndex", 0);

      await expect(sidebarRoot).toHaveAttribute("data-state", "collapsed");

      await rail.focus();
      await expect(rail).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(sidebarRoot).toHaveAttribute("data-state", "expanded");

      // A flat icon retains its real destination; only the global controls expand the sidebar.
      await menuTrigger.focus();
      await page.keyboard.press("Enter");
      await expect(sidebarRoot).toHaveAttribute("data-state", "collapsed");
      const iconBox = await coursesLink.boundingBox();
      expect(iconBox?.width ?? 0).toBeGreaterThanOrEqual(24);
      expect(iconBox?.height ?? 0).toBeGreaterThanOrEqual(24);
      await coursesLink.focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/workspace\/todos$/);
      await expect(coursesLink).toHaveAttribute("aria-current", "page");
    }, {});
  },
);

shellTest(
  "/ shell 订阅子路由把父级标为所在路径",
  { tag: "@Site/Web" },
  async ({ communityFlow, page, account: _account }) => {
    await communityFlow.run(
      async () => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await gotoAndWaitForReady(
          page,
          "/workspace/subscriptions/activities?view=events",
        );

        const navigation = page
          .getByTestId("app-sidebar")
          .locator('[data-shell-navigation="desktop"]');
        await expect(navigation).toHaveAttribute(
          "data-shell-navigation-view",
          "activity-workspace",
        );
        await expect(navigation.locator('[aria-current="page"]')).toHaveCount(
          1,
        );
        await expect(
          navigation.locator(
            'a[href="/workspace/subscriptions/activities?view=events"]',
          ),
        ).toHaveAttribute("aria-current", "page");
        await expect(
          navigation.locator('[data-slot="sidebar-content"] a'),
        ).toHaveCount(3);
        const originalUrl = page.url();
        await page.getByTestId("activity-workspace-sidebar-back").click();
        expect(page.url()).toBe(originalUrl);
        await expect(navigation).toHaveAttribute(
          "data-shell-navigation-view",
          "workspace",
        );
        const parent = navigation.locator('a[href="/workspace/subscriptions"]');
        await expect(parent).toBeVisible();
        await expect(parent).toHaveAttribute("data-shell-ancestor", "true");
        await expect(parent).toHaveAttribute("aria-current", "location");
        await parent.click();
        await page.waitForURL("**/workspace/subscriptions");
        await waitForUiSettled(page);
        await expect(parent).toHaveAttribute("aria-current", "page");
        await expect(parent).not.toHaveAttribute("data-shell-ancestor", "true");
        await expect(navigation.locator('[aria-current="page"]')).toHaveCount(
          1,
        );
      },
      { calendarTokenCreated: true },
    );
  },
);

shellTest(
  "/ shell 当前分组在导航后保持展开",
  { tag: "@Site/Web" },
  async ({ communityFlow, page, account: _account }) => {
    await communityFlow.run(
      async () => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await gotoAndWaitForReady(page, "/workspace/calendar");

        const navigation = page
          .getByTestId("app-sidebar")
          .locator('[data-shell-navigation="desktop"]');
        await expect(
          navigation.getByRole("link", { name: /^(日历|Calendar)$/i }),
        ).toBeVisible();
        await expect(
          navigation.locator(
            '[data-slot="sidebar-menu-sub"],button[aria-expanded]',
          ),
        ).toHaveCount(0);
        await page.evaluate(() => {
          const key = "life-ustc.sidebar.v1";
          const previous = JSON.parse(localStorage.getItem(key) ?? "{}");
          localStorage.setItem(
            key,
            JSON.stringify({
              ...previous,
              groups: { courses: false },
              submenus: { sections: false },
            }),
          );
        });

        // The empty overview exposes the same real course discovery route in its content.
        await navigation
          .getByRole("link", { name: /^Life@USTC: (Home|首页)$/, exact: true })
          .click();
        await page
          .locator("[data-shell-scroll-container]")
          .getByRole("link", { name: /浏览课程|Browse Courses/i })
          .click();
        await page.waitForURL("**/catalog/courses");
        await waitForUiSettled(page);

        await expect(
          navigation.locator(
            '[data-slot="sidebar-menu-sub"],button[aria-expanded]',
          ),
        ).toHaveCount(0);
        await expect(
          navigation.getByRole("link", {
            name: /^(浏览课程|Browse courses)$/i,
          }),
        ).toHaveAttribute("aria-current", "page");
        await expect(navigation.locator('[aria-current="page"]')).toHaveCount(
          1,
        );
      },
      { calendarTokenCreated: true },
    );
  },
);

shellTest(
  "ui.shell-layout-8",
  { tag: "@Site/Web" },
  async ({ communityFlow, page, administrator: _administrator }) => {
    await communityFlow.run(async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await gotoAndWaitForReady(page, "/workspace/todos");

      await expect(
        page.locator("[data-mobile-primary-navigation]"),
      ).toHaveCount(1);
      const selector =
        "[data-shell-topbar] button:visible, [data-shell-topbar] a:visible";
      const controls = page.locator(selector);
      expect(await controls.count()).toBeGreaterThan(0);
      for (const control of await controls.all()) {
        await expect(control).toBeVisible();
        const box = await control.boundingBox();
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      }

      const topbar = page.locator("[data-shell-topbar]");
      await expect(
        topbar.getByRole("button", { name: /语言|Language/i }),
      ).toBeVisible();
      await expect(
        topbar.getByRole("button", { name: /主题|Theme/i }),
      ).toBeVisible();

      for (const button of [
        topbar.getByRole("button", { name: /^菜单$|^Menu$/i }),
        topbar.getByRole("button", { name: /语言|Language/i }),
        topbar.getByRole("button", { name: /主题|Theme/i }),
      ]) {
        const box = await button.boundingBox();
        expect(box?.width).toBeGreaterThanOrEqual(44);
        expect(box?.height).toBeGreaterThanOrEqual(44);
      }
      await expect(
        topbar.getByRole("button", { name: /个人菜单|Profile menu/i }),
      ).toHaveCount(1);
      const primary = page.locator("[data-mobile-primary-navigation]");
      expect(
        await primary
          .getByRole("link")
          .evaluateAll((nodes) =>
            nodes.map((node) => node.getAttribute("href")),
          ),
      ).toEqual([
        "/",
        "/workspace/calendar",
        "/campus",
        "/catalog/young-events",
      ]);
      await topbar.getByRole("button", { name: /^菜单$|^Menu$/i }).click();
      const sidebar = page.getByRole("dialog", {
        name: /^(Workspace|工作台)$/,
      });
      await expect(sidebar).toBeVisible();
      const group = sidebar.locator('[data-slot="sidebar-group"]');
      await expect(group).toHaveCount(1);
      await expect(
        group.locator('[data-slot="sidebar-group-label"]'),
      ).toHaveText(/^(Workspace|工作台)$/);
      await expect(
        group.locator('[data-slot="sidebar-group-label"]'),
      ).not.toHaveAttribute("aria-expanded");
      await expect(
        group.locator('[data-slot="sidebar-group-content"]'),
      ).toBeVisible();
      await expect(
        group.locator(
          '[data-slot="sidebar-menu-action"],[data-slot="sidebar-menu-sub"]',
        ),
      ).toHaveCount(0);
      await expect(
        sidebar.getByRole("button", { name: /语言|Language/i }),
      ).toHaveCount(0);
      await expect(
        sidebar.getByRole("button", { name: /主题|Theme/i }),
      ).toHaveCount(0);
      await expect(
        sidebar.getByRole("button", { name: /个人菜单|Profile menu/i }),
      ).toHaveCount(0);
      await expect(sidebar.locator('[aria-current="page"]')).toHaveCount(1);
      await expect(
        sidebar.getByRole("link", { name: /^(待办|Todos)$/i }),
      ).toHaveAttribute("aria-current", "page");
      await expect(
        sidebar.getByRole("button", { name: /^Toggle /i }),
      ).toHaveCount(0);
    }, {});
  },
);

shellTest(
  "/ shell 390px 设置子路由保持唯一当前位置",
  { tag: "@Site/Web" },
  async ({ communityFlow, page, account: _account }) => {
    await communityFlow.run(async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await gotoAndWaitForReady(page, "/account/settings/preferences");

      const primaryNavigation = page.getByRole("navigation", {
        name: /^(主导航|Primary navigation)$/i,
      });
      await expect(
        primaryNavigation.getByRole("link", { name: /^(我的|Me)$/i }),
      ).toHaveCount(0);

      await page
        .locator("[data-shell-topbar]")
        .getByRole("button", { name: /^菜单$|^Menu$/i })
        .click();

      const sidebar = page.getByRole("dialog", {
        name: /^(Primary navigation|主导航|Workspace|工作台|Calendar|日历|Settings|设置|Activities|活动|Admin|管理后台)$/,
      });
      const settingsNav = sidebar.getByTestId("settings-sidebar");
      await expect(
        settingsNav.getByRole("link", { name: /偏好设置|Preferences/i }),
      ).toHaveAttribute("aria-current", "page");
      await expect(settingsNav.locator('[aria-current="page"]')).toHaveCount(1);
      await expect(sidebar.getByTestId("settings-sidebar-back")).toBeVisible();
      await page.keyboard.press("Escape");
      await page
        .locator("[data-shell-topbar] #app-user-menu")
        .getByRole("button")
        .click();
      await expect(
        page.getByRole("menuitem", { name: /^(设置|Settings)$/i }),
      ).toHaveAttribute("aria-current", "page");
      await expect(
        page.getByRole("menu").locator('[aria-current="page"]'),
      ).toHaveCount(1);
      await expect(
        primaryNavigation.locator('[aria-current="page"]'),
      ).toHaveCount(0);
    }, {});
  },
);

shellTest(
  "/ shell 菜单支持键盘菜单语义",
  { tag: "@Site/Web" },
  async ({ communityFlow, page, account: _account }) => {
    await communityFlow.run(async () => {
      await gotoAndWaitForReady(page, "/workspace/overview");

      const profileMenuButton = page
        .locator("[data-shell-topbar]")
        .getByRole("button", {
          name: /个人菜单|Profile menu/i,
        });
      await profileMenuButton.focus();
      await page.keyboard.press("Enter");

      const menu = page.getByRole("menu");
      await expect(menu).toBeVisible();
      const profileItem = page.getByRole("menuitem", {
        name: /^(个人主页|Personal page)$/i,
      });
      await expect(profileItem).toBeFocused();
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(resolve)),
      );

      await page.keyboard.press("ArrowDown");
      await expect(
        page.getByRole("menuitem", { name: /设置|Settings/i }),
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
    }, {});
  },
);

test("/ shell 桌面导航后内容滚动回到顶部", { tag: "@Site/Web" }, async ({
  publicFlow,
  page,
}) => {
  await publicFlow.run(async () => {
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
      .getByRole("link", { name: /^(浏览课程|Browse courses)$/i })
      .click();
    await page.waitForURL("**/catalog/courses");
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

    // Observe the destination's actual document and its PublicSsr work after
    // the original client-navigation assertions have completed.
    const catalogResponse = await gotoAndWaitForReady(page, "/catalog/courses");
    expect(catalogResponse?.status()).toBe(200);
  }, {});
});

test("/ shell 折叠桌面侧边栏后分组入口展开并可跳转", {
  tag: "@Site/Web",
}, async ({ publicFlow, page }) => {
  await publicFlow.run(async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAndWaitForReady(page, "/");

    const sidebar = page.getByTestId("app-sidebar");
    const campusLink = sidebar.locator(
      '[data-slot="sidebar-content"] a[href="/campus"]',
    );
    await expect(campusLink).toBeVisible();
    await expect(
      sidebar.locator("button[data-shell-expand-sidebar]"),
    ).toHaveCount(0);
    const rail = page.locator('[data-sidebar="rail"]');
    await rail.click();
    await expect(
      page.locator('[data-slot="sidebar"][data-state="collapsed"]'),
    ).toBeVisible();
    await expect(campusLink).toBeVisible();
    await expect(campusLink).toHaveAccessibleName(/^(Campus|校园)$/);
    await expect
      .poll(async () => (await campusLink.boundingBox())?.width ?? 0)
      .toBeLessThanOrEqual(40);
    await rail.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.locator('[data-slot="sidebar"][data-state="expanded"]'),
    ).toBeVisible();
    await expect
      .poll(async () => (await campusLink.boundingBox())?.width ?? 0)
      .toBeGreaterThan(100);
    await campusLink.click();
    await expect(page).toHaveURL(/\/campus$/);
    const coursesLink = sidebar.locator('a[href="/catalog/courses"]');
    await expect(coursesLink).toBeVisible();
    await coursesLink.click();
    await page.waitForURL("**/catalog/courses");
    await waitForUiSettled(page);
    await expect(coursesLink).toHaveAttribute("aria-current", "page");
    const catalogResponse = await gotoAndWaitForReady(page, "/catalog/courses");
    expect(catalogResponse?.status()).toBe(200);
    await rail.click();
    await expect(coursesLink).toHaveAttribute("aria-current", "page");
    await expect(
      sidebar.locator("button[data-shell-expand-sidebar]"),
    ).toHaveCount(0);
  }, {});
});

shellTest(
  "/ 登录用户在空状态总览页可看到教学班发现入口",
  { tag: "@Site/Web" },
  async ({ communityFlow, page, account, isolatedWorker }) => {
    await communityFlow.run(async () => {
      test.setTimeout(300_000);
      await gotoAndWaitForReady(page, "/workspace/overview");

      expect(
        await isolatedWorker.database.owner.userSectionSubscription.findMany({
          where: { userId: account.id },
        }),
      ).toEqual([]);
      const content = page.getByTestId("home-personal-overview");
      await expect(content).toBeVisible();

      await expect(
        content.getByRole("link", { name: /浏览教学班|Browse Sections/i }),
      ).toBeVisible();
      await expect(
        content.getByRole("link", { name: /浏览课程|Browse Courses/i }),
      ).toBeVisible();
      await expect(
        content.getByRole("link", { name: /浏览教学班|Browse Sections/i }),
      ).toHaveAttribute("href", "/catalog/sections");
      await expect(
        content.getByRole("link", { name: /浏览课程|Browse Courses/i }),
      ).toHaveAttribute("href", "/catalog/courses");
      await expect(
        content.getByRole("link", { name: /按代码匹配|Match by Code/i }),
      ).toBeVisible();
    }, {});
  },
);

shellTest(
  "cases.semester.only-non-current-semester-subscriptions-3",
  { tag: "@Site/Web" },
  async ({ communityFlow, page, historical }) => {
    await communityFlow.run(
      async () => {
        test.setTimeout(300_000);
        await page.setViewportSize({ height: 844, width: 390 });
        await gotoAndWaitForReady(page, "/workspace/overview");

        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);

        await expect(
          page.getByText(
            /往期教学班、作业、课表和考试仍然保留|past sections, homework, schedules, and exams are still available/i,
          ),
        ).toBeVisible();
        await expect(
          page.getByRole("link", { name: /查看往期作业|View Past Homework/i }),
        ).toBeVisible();
        await expect(
          page.getByRole("link", { name: /查看往期课表|View Past Schedule/i }),
        ).toHaveAttribute(
          "href",
          `/workspace/calendar?calendarSemester=${historical.semesterId}`,
        );
        await expect(
          page.getByRole("link", {
            name: /查看往期教学班|View Past Sections/i,
          }),
        ).toBeVisible();

        const response = await page.request.get("/api/workspace/homeworks");
        expect(response.status()).toBe(200);
        const body = (await response.json()) as {
          data?: Array<{ sectionId?: number; title?: string }>;
        };
        expect(
          body.data?.every((item) => item.sectionId === historical.sectionId),
        ).toBe(true);
        expect(body.data).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ title: historical.homeworkTitle }),
          ]),
        );

        const schedulesResponse = await page.request.get(
          `/api/workspace/schedules?dateFrom=${historical.dates[0]}&dateTo=${historical.dates[1]}`,
        );
        expect(schedulesResponse.status()).toBe(200);
        const schedulesBody = (await schedulesResponse.json()) as {
          schedules?: Array<{ section?: { id?: number } }>;
        };
        expect(schedulesBody.schedules).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              section: expect.objectContaining({ id: historical.sectionId }),
            }),
          ]),
        );
        await page
          .getByRole("link", { name: /查看往期作业|View Past Homework/i })
          .click();
        await expect(page).toHaveURL(/\/workspace\/homeworks/);
        await expect(
          page.getByText(historical.homeworkTitle).filter({ visible: true }),
        ).toBeVisible();

        await page.setViewportSize({ height: 900, width: 1280 });
        await page.goto("/");
        await waitForUiSettled(page);
        await page
          .getByRole("link", { name: /查看往期课表|View Past Schedule/i })
          .click();
        await expect(page).toHaveURL(
          new RegExp(
            `/workspace/calendar\\?calendarSemester=${historical.semesterId}$`,
          ),
        );
        await expect(
          page
            .getByText(historical.courseName)
            .filter({ visible: true })
            .first(),
        ).toBeVisible();
      },
      { calendarTokenCreated: true },
    );
  },
);
