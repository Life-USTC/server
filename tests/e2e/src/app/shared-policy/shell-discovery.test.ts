import { expect } from "@playwright/test";
import { createDeferred } from "../../../../shared/deferred";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../utils/page-ready";
import { test } from "../../../utils/personal-preferences-fixture";
import { expectRenderedUiQuality } from "../../../utils/ui-quality";

for (const locale of ["en-us", "zh-cn"] as const) {
  for (const width of [1280, 390]) {
    test(
      `shell.discovery scope and signed-in account ${locale} ${width}`,
      { tag: "@Site/Web" },
      async ({ page, isolatedWorker, preferenceFlow }, info) => {
        const day =
          process.env.SHELL_DISCOVERY_FIXTURE_DAY ??
          new Date().toISOString().slice(0, 10);
        const anchor = new Date(`${day}T00:00:00Z`);
        const at = (days: number) =>
          new Date(anchor.getTime() + days * 86400000);
        const fixture = await preferenceFlow.prepare(async () => {
          const db = isolatedWorker.database.owner;
          const actor = await isolatedWorker.createActor();
          await db.user.update({
            where: { id: actor.id },
            data: { name: "Navigation discovery fixture" },
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
          return { actor, section, semester, expected: [4, 1, 2, 1, 1, 1] };
        });
        await preferenceFlow.run(async () => {
          await page.setViewportSize({ width, height: 950 });
          await page.context().addCookies([
            fixture.actor.cookie,
            {
              name: "NEXT_LOCALE",
              value: locale,
              url: isolatedWorker.origin,
            },
          ]);
          const accountObservations = [];
          const routes = [
            `/catalog/sections/${fixture.section.jwId}`,
            "/account/settings/profile",
            "/catalog/young-events",
            "/workspace/todos",
          ];
          let discovery: Record<string, unknown> = {};
          const navigation = async () => {
            if (width === 390 && !(await page.getByRole("dialog").isVisible()))
              await page
                .locator('[data-shell-topbar] [data-slot="sidebar-trigger"]')
                .click();
            return width === 390
              ? page.getByRole("dialog")
              : page.locator('[data-shell-navigation="desktop"]');
          };
          for (const [index, path] of routes.entries()) {
            await gotoAndWaitForReady(page, path);
            await navigation();
            if (index === 0) {
              const hrefs = [
                "/workspace/calendar",
                "/workspace/homeworks",
                "/workspace/todos",
                "/workspace/exams",
                "/workspace/subscriptions",
                "/workspace/subscriptions/activities?view=notifications",
              ];
              const readFact = async (href: string) => {
                const link = page.locator(
                  `[data-shell-navigation="${width === 390 ? "mobile" : "desktop"}"] a[data-sidebar="menu-button"][href="${href}"]`,
                );
                await expect(link).toHaveCount(1);
                const row = link.locator(
                  'xpath=ancestor::*[@data-slot="sidebar-menu-item"][1]',
                );
                const explicit = row.locator("[data-shell-count-value]");
                await expect(explicit).toHaveCount(1);
                const text = await explicit.getAttribute(
                  "data-shell-count-value",
                );
                return {
                  href,
                  count: Number.parseInt(text ?? "", 10),
                  text: await row.textContent(),
                  geometry: await link.evaluate((node) => {
                    const label = node.querySelector(
                      ":scope > span:last-child",
                    );
                    const summary = node.parentElement?.querySelector(
                      "[data-shell-count-value]",
                    );
                    const measure = (element: Element | null | undefined) =>
                      element instanceof HTMLElement
                        ? {
                            text: element.textContent,
                            width: element.clientWidth,
                            scrollWidth: element.scrollWidth,
                            left: element.getBoundingClientRect().left,
                            right: element.getBoundingClientRect().right,
                          }
                        : null;
                    return { label: measure(label), summary: measure(summary) };
                  }),
                };
              };
              const facts = [];
              for (const [factIndex, href] of hrefs.entries()) {
                if (factIndex === 0 || factIndex === 1) {
                  await gotoAndWaitForReady(
                    page,
                    factIndex === 0
                      ? "/workspace/calendar"
                      : "/workspace/todos",
                  );
                  await navigation();
                }
                await expect
                  .poll(async () => (await readFact(href)).count)
                  .toBe(fixture.expected[factIndex]);
                facts.push(await readFact(href));
              }
              await page.evaluate(() => document.fonts.ready);
              await gotoAndWaitForReady(page, "/usage/mcp");
              const apps = await navigation();
              const mcp = apps.locator('a[href="/usage/mcp"]');
              const root = apps.locator("#app-logo");
              await expect(mcp).toHaveCount(1);
              await expect(root).toHaveCount(1);
              discovery = {
                day,
                path,
                locale,
                width,
                facts,
                mcpText: await mcp.textContent(),
                rootText: await root.textContent(),
                hints: await apps.locator("[data-shell-nav-hint]").count(),
                accountRoutes: routes,
              };
              await info.attach(`discovery-nav-${locale}-${width}`, {
                body: await page.screenshot(),
                contentType: "image/png",
              });
              for (const fact of facts) {
                if (fact.geometry.label && fact.geometry.summary)
                  expect(
                    fact.geometry.label.right,
                    `${fact.href} label/count overlap`,
                  ).toBeLessThanOrEqual(fact.geometry.summary.left);
                for (const [kind, box] of Object.entries(fact.geometry)) {
                  // A visible container can still clip an unbroken destination word.
                  // Check its own content width, rather than only document overflow.
                  if (box)
                    expect(
                      box.scrollWidth,
                      `${fact.href} ${kind}: ${box.text}`,
                    ).toBeLessThanOrEqual(box.width + 1);
                }
              }
            }
            if (index === 0) await gotoAndWaitForReady(page, path);
            if (
              width === 390 &&
              (await page
                .locator(
                  '[data-slot="sidebar"][data-mobile="true"][role="dialog"]',
                )
                .isVisible())
            )
              await page.keyboard.press("Escape");
            const menus = page.locator("#app-user-menu:visible");
            await expect(menus).toHaveCount(1);
            const button = menus.getByRole("button");
            await expect(button).toHaveCount(1);
            await expect(button).toHaveAccessibleName(
              locale === "en-us" ? "Profile menu" : "个人菜单",
            );
            const placement = await menus.evaluate((node) =>
              node.closest("[data-shell-topbar]") ? "topbar" : "unknown",
            );
            expect(placement).toBe("topbar");
            await expect(button).toHaveAttribute(
              "title",
              "Navigation discovery fixture",
            );
            await button.focus();
            await page.keyboard.press("Enter");
            const menu = page.getByRole("menu");
            await expect(menu).toHaveCount(1);
            await expect(
              menu.getByRole("menuitem", {
                name: locale === "en-us" ? "Settings" : "设置",
                exact: true,
              }),
            ).toHaveAttribute("href", "/account/settings/preferences");
            await expect(
              menu.getByRole("menuitem", {
                name: locale === "en-us" ? "Personal page" : "个人主页",
                exact: true,
              }),
            ).toHaveCount(1);
            accountObservations.push({
              path,
              placement,
              name: await button.textContent(),
              items: await menu.textContent(),
            });
            await info.attach(`account-${index}-${locale}-${width}`, {
              body: await page.screenshot(),
              contentType: "image/png",
            });
            await page.keyboard.press("Escape");
            await expect(button).toBeFocused();
            await page.keyboard.press("Enter");
            await expect(page.getByRole("menu")).toHaveCount(1);
            await page
              .getByRole("menuitem", {
                name: locale === "en-us" ? "Settings" : "设置",
                exact: true,
              })
              .focus();
            await page.keyboard.press("Enter");
            await waitForUiSettled(page);
            await expect(page).toHaveURL(
              new URL(
                "/account/settings/preferences",
                isolatedWorker.origin,
              ).toString(),
            );
            await expect(page.getByRole("menu")).toHaveCount(0);
            if (width === 390)
              await expect(page.getByRole("dialog")).toHaveCount(0);
            expect(
              await page.evaluate(() =>
                Boolean(document.activeElement?.closest('[role="menu"]')),
              ),
            ).toBe(false);
          }
          await info.attach(`discovery-observations-${locale}-${width}`, {
            body: JSON.stringify(
              {
                discovery,
                accountObservations,
                countsFromRealFixture: fixture.expected,
              },
              null,
              2,
            ),
            contentType: "application/json",
          });
          await gotoAndWaitForReady(
            page,
            `/catalog/sections/${fixture.section.jwId}`,
          );
          const nav = await navigation();
          await expect(
            nav.locator('button[data-slot="sidebar-group-label"]'),
          ).toHaveCount(0);
          await nav.locator("[data-local-navigation-back]").click();
          await expect(
            page.locator(
              `[data-shell-navigation="${width === 390 ? "mobile" : "desktop"}"]`,
            ),
          ).toHaveAttribute("data-shell-navigation-view", "campus");
          await nav.locator("[data-local-navigation-back]").click();
          await expect(
            page.locator(
              `[data-shell-navigation="${width === 390 ? "mobile" : "desktop"}"]`,
            ),
          ).toHaveAttribute("data-shell-navigation-view", "root");
          const home = nav.locator("#app-logo");
          const state = {
            homeNamed: await home
              .getByText(locale === "en-us" ? "Home" : "首页", { exact: true })
              .isVisible(),
            hintCount: await nav.locator("[data-shell-nav-hint]").count(),
            distinctChineseGroup:
              locale !== "zh-cn" ||
              (await nav
                .getByRole("link", { name: "活动", exact: true })
                .count()) === 1,
          };
          expect.soft(state).toEqual({
            homeNamed: true,
            hintCount: 0,
            distinctChineseGroup: true,
          });
          await expect(
            nav.locator("details, summary, [data-shell-nav-hint]"),
          ).toHaveCount(0);
          // Audit the real loaded badges as well as the navigation-time shell.
          await expectRenderedUiQuality(page);
          if (width === 390) await page.keyboard.press("Escape");
          await gotoAndWaitForReady(page, "/usage/mobile");
          const apps = await navigation();
          const mcp = apps.locator('a[href="/usage/mcp"]');
          await expect(mcp).toHaveCount(1);
          await expect(mcp).toHaveText(
            locale === "en-us" ? "AI assistants (MCP)" : "AI 助手（MCP）",
          );
          await mcp.click();
          await waitForUiSettled(page);
          await expect(page).toHaveURL(
            new URL("/usage/mcp", isolatedWorker.origin).toString(),
          );
          if (width === 390)
            await expect(page.getByRole("dialog")).toHaveCount(0);
          if (width === 390 && locale === "en-us") {
            await gotoAndWaitForReady(page, "/catalog/young-events");
            await navigation();
            await page.keyboard.press("Escape");
            const mobileAccount = page
              .locator("#app-user-menu:visible")
              .getByRole("button");
            await expect(mobileAccount).toHaveCount(1);
            await mobileAccount.focus();
            await page.keyboard.press("Enter");
            await expect(page.getByRole("menu")).toHaveCount(1);
            await page.setViewportSize({ width: 1280, height: 950 });
            await expect(page.locator('[data-mobile="true"]')).toHaveCount(0);
            const visibleAccount = page
              .locator("#app-user-menu:visible")
              .getByRole("button");
            await expect(visibleAccount).toHaveCount(1);
            await expect(page.getByRole("menu")).toHaveCount(1);
            await page
              .getByRole("menuitem", { name: "Settings", exact: true })
              .focus();
            await page.keyboard.press("Enter");
            await waitForUiSettled(page);
            await expect(page).toHaveURL(/\/account\/settings\/preferences$/);
            await expect(page.getByRole("menu")).toHaveCount(0);
          }
        });
      },
    );
  }
}

test(
  "shell.discovery late real counts keep the active workspace destination readable",
  {
    tag: "@Site/Web",
  },
  async ({ page, isolatedWorker, preferenceFlow, account }, info) => {
    await preferenceFlow.prepare(async () => {
      await isolatedWorker.database.owner.user.update({
        where: { id: account.id },
        data: {
          name: "Sidebar reveal fixture",
          username: "sidebar-reveal-fixture",
        },
      });
      // Establish the real owner with summary zero before seeding the next
      // refresh. Initial null -> user bootstrap is not a same-owner update.
      await page.setViewportSize({ width: 390, height: 950 });
      await page
        .context()
        .addCookies([
          { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
        ]);
      const [initialBootstrap] = await Promise.all([
        page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === "/_internal/shell-bootstrap",
        ),
        gotoAndWaitForReady(page, "/account/settings/danger"),
      ]);
      expect(initialBootstrap.status()).toBe(200);
      expect((await initialBootstrap.json()).navigation).toMatchObject({
        userId: account.id,
        unreadActivityNotificationsCount: 0,
      });
      expect(await initialBootstrap.finished()).toBeNull();
      await expect(
        page
          .locator("[data-shell-topbar] #app-user-menu")
          .getByRole("button", { name: "Profile menu", exact: true }),
      ).toHaveAttribute("title", "Sidebar reveal fixture");
      await isolatedWorker.database.owner.youngNotification.create({
        data: {
          userId: account.id,
          kind: "late_navigation",
          title: "Late count fixture",
          body: "Owned navigation sample",
          dedupeKey: crypto.randomUUID(),
        },
      });
    });
    await preferenceFlow.run(async () => {
      await page.setViewportSize({ width: 390, height: 950 });
      await page
        .context()
        .addCookies([
          { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
        ]);
      const captured = createDeferred();
      // Observe early rejection without replacing the promise awaited below.
      void captured.promise.catch(() => {});
      const release = createDeferred();
      const handlerCompleted = createDeferred();
      void handlerCompleted.promise.catch(() => {});
      preferenceFlow.onClosing(() => {
        release.resolve();
        handlerCompleted.reject(
          new Error("Scenario closed before held handler completed"),
        );
        captured.reject(
          new Error("Scenario closed before shell bootstrap capture"),
        );
      });
      await preferenceFlow.route(
        page,
        "**/_internal/shell-bootstrap",
        async (route) => {
          try {
            const response = await route.fetch();
            expect(response.status()).toBe(200);
            const body = await response.json();
            expect(body.viewer).toMatchObject({
              id: account.id,
              name: "Sidebar reveal fixture",
              username: "sidebar-reveal-fixture",
            });
            expect(body.navigation).toMatchObject({
              userId: account.id,
              unreadActivityNotificationsCount: 1,
            });
            captured.resolve();
            await release.promise;
            await route.fulfill({ response });
          } catch (error) {
            captured.reject(error);
            throw error;
          } finally {
            handlerCompleted.resolve();
          }
        },
      );
      let originalDocument:
        | import("@playwright/test").JSHandle<Document>
        | undefined;
      let originalMain:
        | import("@playwright/test").JSHandle<HTMLElement>
        | undefined;
      try {
        const logo = page.locator("[data-shell-topbar] [data-shell-brand]");
        await expect(logo).toHaveCount(1);
        await Promise.all([logo.click(), captured.promise]);
        await page.waitForFunction(
          () => document.documentElement.dataset.lifeUstcHydrated === "true",
        );
        await expect(
          page.getByRole("heading", {
            level: 1,
            name: "Overview",
            exact: true,
          }),
        ).toBeVisible();
        await page
          .locator('[data-shell-topbar] [data-slot="sidebar-trigger"]')
          .click();
        const nav = page.getByTestId("workspace-sidebar");
        const preview = page.getByTestId("workspace-sidebar-back");
        const routeBefore = page.url();
        originalDocument = await page.evaluateHandle(() => document);
        originalMain = await page.evaluateHandle(() => {
          const node = document.querySelector("#main-content");
          if (!(node instanceof HTMLElement))
            throw new Error("Missing unique main");
          return node;
        });
        const activity = nav.locator(
          'a[data-sidebar="menu-button"][href="/workspace/subscriptions/activities?view=notifications"]',
        );
        const row = activity.locator(
          'xpath=ancestor::*[@data-slot="sidebar-menu-item"][1]',
        );
        await expect(row.locator("[data-shell-count-value]")).toHaveCount(0);
        await preview.click();
        await expect(nav).toHaveAttribute("data-shell-navigation-view", "root");
        await expect(preview).toHaveAccessibleName("Return to Workspace");
        const active = nav.locator('a[aria-current="page"]');
        const sheet = page.locator(
          '[data-slot="sidebar"][data-mobile="true"][role="dialog"]',
        );
        await expect(sheet).toBeVisible();
        await expect(active).toBeVisible();
        await expect(active).toHaveAttribute("href", "/");
        const activeVisible = () =>
          active.evaluate((node) => {
            const viewport = node.closest('[data-slot="sidebar-content"]');
            if (!viewport) return false;
            const item = node.getBoundingClientRect(),
              box = viewport.getBoundingClientRect(),
              style = getComputedStyle(viewport);
            return (
              item.width > 0 &&
              item.height > 0 &&
              Math.min(
                innerWidth,
                box.right - Number.parseFloat(style.borderRightWidth),
              ) >
                Math.max(
                  0,
                  box.left + Number.parseFloat(style.borderLeftWidth),
                ) &&
              Math.min(
                innerHeight,
                box.bottom - Number.parseFloat(style.borderBottomWidth),
              ) >
                Math.max(
                  0,
                  box.top + Number.parseFloat(style.borderTopWidth),
                ) &&
              item.left >=
                Math.max(
                  0,
                  box.left + Number.parseFloat(style.borderLeftWidth),
                ) &&
              item.right <=
                Math.min(
                  innerWidth,
                  box.right - Number.parseFloat(style.borderRightWidth),
                ) &&
              item.top >=
                Math.max(
                  0,
                  box.top + Number.parseFloat(style.borderTopWidth),
                ) &&
              item.bottom <=
                Math.min(
                  innerHeight,
                  box.bottom - Number.parseFloat(style.borderBottomWidth),
                )
            );
          });
        await expect.poll(activeVisible).toBe(true);
        const response = preferenceFlow.waitForResponse(page, (res) =>
          res.url().endsWith("/_internal/shell-bootstrap"),
        );
        release.resolve();
        const received = await response;
        expect(await received.finished()).toBeNull();
        await handlerCompleted.promise;
        await expect(nav).toHaveAttribute("data-shell-navigation-view", "root");
        await expect(preview).toHaveAccessibleName("Return to Workspace");
        await expect(sheet).toBeVisible();
        await expect(active).toBeVisible();
        await expect(preview).toBeFocused();
        expect(page.url()).toBe(routeBefore);
        expect(
          await originalDocument.evaluate((node) => node === document),
        ).toBe(true);
        expect(
          await originalMain.evaluate(
            (node) => node === document.querySelector("#main-content"),
          ),
        ).toBe(true);
        await preview.click();
        await expect(nav).toHaveAttribute(
          "data-shell-navigation-view",
          "workspace",
        );
        expect(page.url()).toBe(routeBefore);
        expect(
          await originalDocument.evaluate((node) => node === document),
        ).toBe(true);
        expect(
          await originalMain.evaluate(
            (node) => node === document.querySelector("#main-content"),
          ),
        ).toBe(true);
        await expect(active).toHaveAttribute("href", "/");
        await expect(active).toBeVisible();
        const summary = row.locator("[data-shell-count-value]");
        await expect(summary).toBeVisible();
        await expect(summary).toHaveAttribute("data-shell-count-value", "1");
        await expect(summary).toHaveText("1");
        await expect(summary).toHaveAccessibleName(/1 unread.*not expired/);
        await expect.poll(activeVisible).toBe(true);
        const label = activity.locator(":scope > span:last-child");
        await expect(label).toBeVisible();
        await expect(label).toHaveText("Activity subscriptions");
        const readable = await row.evaluate((element) => {
          const a = element.querySelector('a[data-sidebar="menu-button"]');
          const label = a?.querySelector(":scope > span:last-child"),
            summary = element.querySelector("[data-shell-count-value]");
          return (
            label instanceof HTMLElement &&
            summary instanceof HTMLElement &&
            label.getBoundingClientRect().width > 0 &&
            label.getBoundingClientRect().height > 0 &&
            summary.getBoundingClientRect().width > 0 &&
            summary.getBoundingClientRect().height > 0 &&
            label.clientWidth > 0 &&
            summary.clientWidth > 0 &&
            label.getBoundingClientRect().right <=
              summary.getBoundingClientRect().left &&
            label.scrollWidth <= label.clientWidth &&
            summary.scrollWidth <= summary.clientWidth
          );
        });
        expect(readable).toBe(true);
      } finally {
        release.resolve();
        await originalDocument?.dispose();
        await originalMain?.dispose();
        const sheet = page.locator(
          '[data-slot="sidebar"][data-mobile="true"][role="dialog"]',
        );
        if (
          !page.isClosed() &&
          (await sheet.count()) === 1 &&
          (await sheet.isVisible())
        )
          await sheet.screenshot({
            path: info.outputPath("late-count-workspace-390.png"),
          });
      }
    });
  },
);
