import { expect, type Request } from "@playwright/test";
import { createDeferred } from "../../../../shared/deferred";
import { createSignedDemoCookie } from "../../../../shared/demo-token";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../utils/page-ready";
import { test } from "../../../utils/personal-preferences-fixture";

test.use({ workerBindings: { DEMO_ENABLED: "1", E2E_DEBUG_AUTH: "0" } });

for (const [locale, width] of [
  ["en-us", 1280],
  ["zh-cn", 390],
] as const) {
  for (const context of ["settings", "young", "admin"] as const) {
    const isAdmin = context === "admin";
    test(`sidebar.root-preview context ${context} ${locale}`, {
      tag: "@Site/Web",
    }, async ({ page, isolatedWorker, preferenceFlow }) => {
      const menuName = locale === "en-us" ? "Menu" : "菜单";
      const anchor = new Date("2026-11-12T00:00:00Z");
      const at = (days: number) => new Date(anchor.getTime() + days * 86400000);
      const fixture = await preferenceFlow.prepare(async () => {
        const db = isolatedWorker.database.owner;
        const actor = await isolatedWorker.createActor({ isAdmin });
        await db.user.update({
          where: { id: actor.id },
          data: {
            name: "Sidebar reader",
            username: isAdmin ? "sidebar-case-admin" : "sidebar-reader",
            email: "sidebar-reader@example.test",
            createdAt: new Date("2026-01-01T00:00:00Z"),
          },
        });
        const semester = await db.semester.create({
          data: {
            jwId: 1800142620,
            code: "DISCOVERY",
            nameCn: "导航计数测试学期",
            startDate: at(-7),
            endDate: at(14),
          },
        });
        const course = await db.course.create({
          data: {
            jwId: 1800142621,
            code: "DISCOVERY",
            nameCn: "导航发现性课程",
            nameEn: "Navigation discovery course",
          },
        });
        const section = await db.section.create({
          data: {
            jwId: 1800142622,
            code: "DISCOVERY.01",
            courseId: course.id,
            semesterId: semester.id,
          },
        });
        const group = await db.scheduleGroup.create({
          data: {
            jwId: 1800142623,
            no: 1,
            limitCount: 10,
            stdCount: 1,
            actualPeriods: 2,
            isDefault: true,
            sectionId: section.id,
          },
        });
        await db.schedule.create({
          data: {
            periods: 2,
            date: anchor,
            weekday: anchor.getUTCDay(),
            startTime: 800,
            endTime: 945,
            weekIndex: 1,
            startUnit: 1,
            endUnit: 2,
            sectionId: section.id,
            scheduleGroupId: group.id,
          },
        });
        await db.exam.create({
          data: {
            jwId: 1800142624,
            examDate: at(7),
            startTime: 1000,
            endTime: 1100,
            sectionId: section.id,
          },
        });
        await db.userSectionSubscription.create({
          data: { userId: actor.id, sectionId: section.id },
        });
        await db.homework.create({
          data: {
            title: "Discovery homework",
            sectionId: section.id,
            submissionDueAt: at(2),
          },
        });
        await db.todo.createMany({
          data: [
            {
              userId: actor.id,
              title: "Dated pending discovery",
              dueAt: at(2),
            },
            { userId: actor.id, title: "Undated pending discovery" },
            {
              userId: actor.id,
              title: "Completed discovery",
              dueAt: at(2),
              completed: true,
            },
          ],
        });
        await db.youngNotification.createMany({
          data: [
            {
              userId: actor.id,
              kind: "discovery",
              title: "Current discovery",
              body: "Fixture",
              dedupeKey: "current",
              expiresAt: at(7),
            },
            {
              userId: actor.id,
              kind: "discovery",
              title: "Expired discovery",
              body: "Fixture",
              dedupeKey: "expired",
              expiresAt: at(-7),
            },
            {
              userId: actor.id,
              kind: "discovery",
              title: "Read discovery",
              body: "Fixture",
              dedupeKey: "read",
              readAt: at(-1),
              expiresAt: at(7),
            },
          ],
        });

        if (isAdmin)
          await db.user.create({
            data: {
              id: crypto.randomUUID(),
              username: "sidebar-case-reader",
              name: "Sidebar ordinary reader",
              email: "sidebar-case-reader@example.test",
              createdAt: new Date("2026-01-02T00:00:00Z"),
            },
          });
        return { actor, section };
      });
      await preferenceFlow.run(async () => {
        await page.setViewportSize({ width, height: 950 });
        await page
          .context()
          .addCookies([
            fixture.actor.cookie,
            { name: "NEXT_LOCALE", value: locale, url: isolatedWorker.origin },
          ]);
        await page.addInitScript(() =>
          localStorage.setItem(
            "life-ustc.sidebar.v1",
            JSON.stringify({
              open: true,
              groups: {
                day: false,
                admin: false,
                account: false,
                activities: false,
              },
              submenus: {
                settings: false,
                adminModeration: false,
                youngEvents: false,
              },
            }),
          ),
        );
        const route =
          context === "settings"
            ? "/account/settings/profile"
            : context === "young"
              ? "/catalog/young-events"
              : "/admin/users?search=sidebar-case";
        await gotoAndWaitForReady(page, route);
        if (width === 390)
          await page
            .getByRole("button", { name: menuName, exact: true })
            .click();
        const nav = page.getByTestId(`${context}-sidebar`);
        await expect(nav).toBeVisible();
        await expect(nav.locator('a[aria-current="page"]')).toHaveCount(1);
        await page.evaluate(() => document.fonts.ready);
        const scroll = nav.locator('[data-slot="sidebar-content"]');
        await scroll.evaluate((node) => {
          node.scrollTop = 0;
        });
        await expect
          .poll(() => scroll.evaluate((node) => node.scrollTop))
          .toBe(0);
        await page.screenshot({
          path: `/tmp/life-sidebar1586-after-section-${context}-${locale}-${width}.png`,
        });
        const toggle = page.getByTestId(`${context}-sidebar-back`);
        const rootLabel =
          locale === "en-us" ? "View main navigation" : "查看主导航";
        const rootNavigationLabel =
          locale === "en-us" ? "Primary navigation" : "主导航";
        const sectionLabel =
          context === "settings"
            ? locale === "en-us"
              ? "Settings"
              : "设置"
            : context === "young"
              ? locale === "en-us"
                ? "Second Classroom"
                : "第二课堂"
              : locale === "en-us"
                ? "Admin"
                : "管理后台";
        const restoreLabel =
          locale === "en-us"
            ? `Return to ${sectionLabel}`
            : `返回${sectionLabel}`;
        if (width === 390)
          await expect(page.getByRole("dialog")).toHaveAccessibleName(
            sectionLabel,
          );
        await expect(toggle).toHaveRole("button");
        await expect(toggle).toHaveAccessibleName(rootLabel);
        await expect(toggle).not.toHaveAttribute("href");
        if (context === "settings")
          await page.locator("input#name").fill("Unsaved sidebar draft");
        const original = await page.evaluateHandle(() => ({
          document,
          main: document.querySelector("#main-content"),
          url: location.href,
          state: JSON.stringify(history.state),
          length: history.length,
        }));
        const requests: string[] = [];
        const recordRequest = (request: import("@playwright/test").Request) => {
          if (["document", "fetch", "xhr"].includes(request.resourceType()))
            requests.push(request.url());
        };
        page.on("request", recordRequest);
        try {
          await toggle.focus();
          await page.keyboard.press("Enter");
          await expect(nav).toHaveAttribute(
            "data-shell-navigation-view",
            "root",
          );
          await expect(toggle).toHaveAccessibleName(restoreLabel);
          if (width === 390)
            await expect(page.getByRole("dialog")).toHaveAccessibleName(
              rootNavigationLabel,
            );
          await expect(nav.locator('a[aria-current="page"]')).toHaveCount(1);
          await expect(nav.locator('a[aria-current="page"]')).toBeInViewport({
            ratio: 1,
          });
          await expect(toggle).toBeFocused();
          await expect(
            nav.locator(
              'a[data-slot="sidebar-menu-button"][href="/catalog/courses"]',
            ),
          ).toBeVisible();
          if (context === "admin")
            await expect(nav.locator('a[href="/admin/users"]')).toBeVisible();
          else
            await expect(nav.locator('a[href="/admin/users"]')).toHaveCount(0);
          expect(
            await original.evaluate(
              (owner) =>
                owner.document === document &&
                owner.main === document.querySelector("#main-content") &&
                owner.url === location.href &&
                owner.state === JSON.stringify(history.state) &&
                owner.length === history.length,
            ),
          ).toBe(true);
          await page.screenshot({
            path: `/tmp/life-sidebar1586-after-root-${context}-${locale}-${width}.png`,
          });
          await page.keyboard.press("Space");
          await expect(nav).toHaveAttribute(
            "data-shell-navigation-view",
            context,
          );
          await expect(toggle).toHaveAccessibleName(rootLabel);
          if (width === 390)
            await expect(page.getByRole("dialog")).toHaveAccessibleName(
              sectionLabel,
            );
          await expect(toggle).toBeFocused();
          expect(
            await original.evaluate(
              (owner) =>
                owner.document === document &&
                owner.main === document.querySelector("#main-content") &&
                owner.url === location.href &&
                owner.state === JSON.stringify(history.state) &&
                owner.length === history.length,
            ),
          ).toBe(true);
          if (context === "settings")
            await expect(page.locator("input#name")).toHaveValue(
              "Unsaved sidebar draft",
            );
          expect(requests).toEqual([]);
        } finally {
          page.off("request", recordRequest);
          await original.dispose();
        }
        if (width === 390) {
          await expect(nav).toBeVisible();
          await page.keyboard.press("Escape");
          await expect(nav).toBeHidden();
          await page
            .getByRole("button", { name: menuName, exact: true })
            .click();
          await expect(nav).toHaveAttribute(
            "data-shell-navigation-view",
            context,
          );
        }
        await toggle.click();
        await nav
          .locator(
            'a[data-slot="sidebar-menu-button"][href="/catalog/courses"]',
          )
          .click();
        await expect(page).toHaveURL(/\/catalog\/courses$/);
        if (width === 390) await expect(nav).toBeHidden();
        await page.goBack();
        await expect(page).toHaveURL(
          new RegExp(`${route.replaceAll("?", "\\?")}$`),
        );
        if (width === 390)
          await page
            .getByRole("button", { name: menuName, exact: true })
            .click();
        await expect(page.getByTestId(`${context}-sidebar`)).toHaveAttribute(
          "data-shell-navigation-view",
          context,
        );
        await expect(
          page.getByTestId(`${context}-sidebar-back`),
        ).toHaveAccessibleName(rootLabel);
        if (context === "young" && locale === "en-us") {
          await page.getByTestId("young-sidebar-back").click();
          await expect(page.getByTestId("young-sidebar")).toHaveAttribute(
            "data-shell-navigation-view",
            "root",
          );
          await page.evaluate(() =>
            Object.assign(window, { sidebarRootLocaleDocument: true }),
          );
          await page
            .getByRole("button", { name: "Language selector", exact: true })
            .click();
          const [response] = await Promise.all([
            page.waitForResponse(
              (response) =>
                new URL(response.url()).pathname ===
                  "/api/account/preferences" &&
                response.request().method() === "POST",
            ),
            page.waitForEvent("domcontentloaded"),
            page
              .getByRole("menuitemradio", { name: "中文", exact: true })
              .click(),
          ]);
          expect(response.status()).toBe(200);
          await waitForUiSettled(page);
          expect(
            await page.evaluate(() => !("sidebarRootLocaleDocument" in window)),
          ).toBe(true);
          await expect(page.getByTestId("young-sidebar")).toHaveAttribute(
            "data-shell-navigation-view",
            "young",
          );
          await expect(
            page.getByTestId("young-sidebar-back"),
          ).toHaveAccessibleName("查看主导航");
        }
      });
    });
  }
}

test("sidebar.root-preview retires a held administrator bootstrap on Demo navigation", {
  tag: "@Site/Web",
}, async ({ page, isolatedWorker, preferenceFlow }) => {
  const actor = await preferenceFlow.prepare(async () => {
    const actor = await isolatedWorker.createActor({ isAdmin: true });
    await isolatedWorker.database.owner.user.update({
      where: { id: actor.id },
      data: {
        name: "PrivateSidebarAdministrator",
        username: "private-sidebar-administrator",
      },
    });
    await isolatedWorker.database.owner.youngNotification.createMany({
      data: Array.from({ length: 25 }, (_, index) => ({
        userId: actor.id,
        kind: "sidebar_owner",
        title: `Owned sidebar notification ${index}`,
        body: "Owned navigation fixture",
        dedupeKey: `sidebar-owner-${index}`,
      })),
    });
    return actor;
  });
  await preferenceFlow.run(async () => {
    await page.setViewportSize({ width: 1280, height: 950 });
    await page
      .context()
      .addCookies([
        actor.cookie,
        { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
      ]);
    const captured = createDeferred();
    void captured.promise.catch(() => {});
    const release = createDeferred();
    const terminal = createDeferred();
    void terminal.promise.catch(() => {});
    const handlerCompleted = createDeferred();
    void handlerCompleted.promise.catch(() => {});
    let held: Request | undefined;
    let first = true;
    const onTerminal = (request: Request) => {
      if (request === held) terminal.resolve();
    };
    page.on("requestfinished", onTerminal);
    page.on("requestfailed", onTerminal);
    preferenceFlow.onClosing(() => {
      release.resolve();
      captured.reject(new Error("Closed before bootstrap capture"));
      terminal.reject(new Error("Closed before bootstrap terminal"));
      handlerCompleted.reject(
        new Error("Closed before held bootstrap handler completion"),
      );
    });
    await preferenceFlow.route(
      page,
      "**/_internal/shell-bootstrap",
      async (route) => {
        if (!first) {
          await route.continue();
          return;
        }
        first = false;
        try {
          const response = await route.fetch();
          expect(response.status()).toBe(200);
          const body = await response.json();
          expect(body.viewer).toMatchObject({
            id: actor.id,
            isAdmin: true,
            name: "PrivateSidebarAdministrator",
          });
          expect(body.navigation).toMatchObject({
            userId: actor.id,
            unreadActivityNotificationsCount: 25,
          });
          held = route.request();
          captured.resolve();
          await release.promise;
          await route.fulfill({ response }).catch((error: unknown) => {
            if (route.request().failure()?.errorText !== "net::ERR_ABORTED")
              throw error;
          });
        } catch (error) {
          captured.reject(error);
          handlerCompleted.reject(error);
          throw error;
        } finally {
          handlerCompleted.resolve();
        }
      },
    );
    let original: import("@playwright/test").JSHandle<Document> | undefined;
    try {
      await Promise.all([
        page.goto("/admin/users?search=private-sidebar", {
          waitUntil: "domcontentloaded",
        }),
        captured.promise,
      ]);
      await page.waitForFunction(
        () => document.documentElement.dataset.lifeUstcHydrated === "true",
      );
      const admin = page.getByTestId("admin-sidebar");
      await expect(admin).toBeVisible();
      await page.getByTestId("admin-sidebar-back").click();
      await expect(admin).toHaveAttribute("data-shell-navigation-view", "root");
      await expect(admin.locator('a[href="/admin/users"]')).toBeVisible();
      original = await page.evaluateHandle(() => document);
      await page.context().clearCookies();
      await page.context().addCookies([
        {
          ...(await createSignedDemoCookie({
            issuedAt: Math.floor(Date.now() / 1000),
          })),
          url: isolatedWorker.origin,
        },
        { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
      ]);
      await admin
        .locator(
          'a[data-slot="sidebar-menu-button"][href="/catalog/young-events"]',
        )
        .click();
      await expect(page).toHaveURL(/\/catalog\/young-events$/);
      await waitForUiSettled(page);
      const young = page.getByTestId("young-sidebar");
      await expect(young).toHaveAttribute(
        "data-shell-navigation-view",
        "young",
      );
      expect(await original.evaluate((doc) => doc === document)).toBe(true);
      await expect(page.getByTestId("demo-notice")).toBeVisible();
      await page.getByTestId("young-sidebar-back").click();
      await expect(young).toHaveAttribute("data-shell-navigation-view", "root");
      await expect(young.locator('a[aria-current="page"]')).toHaveCount(1);
      await expect(young.locator('a[aria-current="page"]')).toBeInViewport({
        ratio: 1,
      });
      await expect(young.locator('a[href^="/admin"]')).toHaveCount(0);
      const currentCount = young
        .locator(
          'a[data-slot="sidebar-menu-button"][href="/workspace/subscriptions/activities?view=notifications"]',
        )
        .locator('xpath=ancestor::*[@data-slot="sidebar-menu-item"][1]')
        .locator("[data-shell-count-value]");
      await expect(currentCount).toHaveAttribute(
        "data-shell-count-value",
        "21",
      );
      await page.evaluate(() => {
        const root = document.querySelector('[data-testid="app-sidebar"]');
        if (!(root instanceof HTMLElement))
          throw new Error("Missing live sidebar root");
        const state = {
          leaked: false,
          observer: new MutationObserver(() => {}),
        };
        const check = (node: Node) => {
          if (node.textContent?.includes("PrivateSidebarAdministrator"))
            state.leaked = true;
          if (
            node instanceof Element &&
            (node.matches('[data-shell-count-value="25"],a[href^="/admin"]') ||
              node.querySelector(
                '[data-shell-count-value="25"],a[href^="/admin"]',
              ))
          )
            state.leaked = true;
        };
        state.observer = new MutationObserver((records) => {
          check(root);
          for (const record of records) {
            if (
              record.type === "characterData" &&
              record.oldValue?.includes("PrivateSidebarAdministrator")
            )
              state.leaked = true;
            if (
              record.type === "attributes" &&
              record.attributeName === "data-shell-count-value" &&
              record.oldValue === "25"
            )
              state.leaked = true;
            if (
              record.type === "attributes" &&
              record.attributeName === "href" &&
              record.oldValue?.startsWith("/admin")
            )
              state.leaked = true;
            for (const node of [...record.addedNodes, ...record.removedNodes])
              check(node);
          }
        });
        check(root);
        state.observer.observe(root, {
          subtree: true,
          childList: true,
          characterData: true,
          characterDataOldValue: true,
          attributes: true,
          attributeOldValue: true,
          attributeFilter: ["data-shell-count-value", "href"],
        });
        Object.assign(window, { sidebarRootRetirement: state });
      });
      release.resolve();
      await Promise.all([terminal.promise, handlerCompleted.promise]);
      await page.getByTestId("young-sidebar-back").click();
      await expect(young).toHaveAttribute(
        "data-shell-navigation-view",
        "young",
      );
      await page.getByTestId("young-sidebar-back").click();
      await expect(young).toHaveAttribute("data-shell-navigation-view", "root");
      await expect(currentCount).toHaveAttribute(
        "data-shell-count-value",
        "21",
      );
      await expect(page.getByTestId("young-sidebar-back")).toBeFocused();
      expect(
        await page.evaluate(() => {
          const state = (
            window as Window & {
              sidebarRootRetirement?: {
                leaked: boolean;
                observer: MutationObserver;
              };
            }
          ).sidebarRootRetirement;
          if (!state) throw new Error("Missing real retirement observer");
          state.observer.disconnect();
          return state.leaked;
        }),
      ).toBe(false);
      const bootstrap = await page.request.get("/_internal/shell-bootstrap");
      expect(bootstrap.status()).toBe(200);
      expect(await bootstrap.json()).toMatchObject({
        viewer: null,
        navigation: { unreadActivityNotificationsCount: 21 },
      });
    } finally {
      release.resolve();
      page.off("requestfinished", onTerminal);
      page.off("requestfailed", onTerminal);
      await original?.dispose();
      if (!page.isClosed())
        await page.evaluate(() => {
          const state = (
            window as Window & {
              sidebarRootRetirement?: { observer: MutationObserver };
            }
          ).sidebarRootRetirement;
          state?.observer.disconnect();
        });
    }
  });
});
