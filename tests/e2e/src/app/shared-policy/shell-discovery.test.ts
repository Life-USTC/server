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
            const nav = await navigation();
            if (index === 0) {
              const hrefs = [
                "/workspace/calendar",
                "/workspace/homeworks",
                "/workspace/todos",
                "/workspace/exams",
                "/workspace/subscriptions",
                "/workspace/subscriptions/activities?view=notifications",
              ];
              const readFacts = async () =>
                Promise.all(
                  hrefs.map(async (href) => {
                    const link = nav
                      .locator(`a[href="${href}"]:visible`)
                      .first();
                    const row = link.locator(
                      'xpath=ancestor::*[@data-slot="sidebar-menu-item"][1]',
                    );
                    const explicit = row.locator("[data-shell-count-value]");
                    const badge = row.locator('[data-sidebar="menu-badge"]');
                    const text = (await explicit.count())
                      ? await explicit
                          .first()
                          .getAttribute("data-shell-count-value")
                      : (await badge.count())
                        ? await badge.first().textContent()
                        : "";
                    return {
                      href,
                      count: Number.parseInt(text ?? "", 10),
                      text: await row.textContent(),
                      geometry: await link.evaluate((node) => {
                        const label = node.querySelector(
                          ":scope > span:last-child",
                        );
                        const summary =
                          node.parentElement?.querySelector("summary");
                        const measure = (
                          element: Element | null | undefined,
                        ) =>
                          element instanceof HTMLElement
                            ? {
                                text: element.textContent,
                                width: element.clientWidth,
                                scrollWidth: element.scrollWidth,
                                left: element.getBoundingClientRect().left,
                                right: element.getBoundingClientRect().right,
                              }
                            : null;
                        return {
                          label: measure(label),
                          summary: measure(summary),
                        };
                      }),
                    };
                  }),
                );
              await expect
                .poll(async () => (await readFacts()).map((item) => item.count))
                .toEqual(fixture.expected);
              await page.evaluate(() => document.fonts.ready);
              const facts = await readFacts();
              const mcp = nav.locator('a[href="/usage/mcp"]');
              const root = nav.locator('a[href="/"]').first();
              discovery = {
                day,
                path,
                locale,
                width,
                facts,
                mcpText: await mcp.textContent(),
                rootText: await root.textContent(),
                hints: await nav.locator("[data-shell-nav-hint]").count(),
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
            const menus = page.locator("#app-user-menu:visible");
            await expect(menus).toHaveCount(1);
            const button = menus.getByRole("button").first();
            await expect(button).toContainText(
              locale === "en-us" ? "Profile menu" : "个人菜单",
            );
            const placement = await menus.evaluate((node) =>
              node.closest("footer")
                ? "public-footer"
                : node.closest('[data-slot="sidebar-footer"]')
                  ? "sidebar-footer"
                  : "unknown",
            );
            expect(placement).toBe(
              width === 390 || index !== 2 ? "sidebar-footer" : "public-footer",
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
          const apps = nav.getByRole("button", {
            name: locale === "en-us" ? "Apps" : "应用",
            exact: true,
          });
          await expect(apps).toBeVisible();
          if ((await apps.getAttribute("aria-expanded")) !== "true") {
            await apps.focus();
            await expect(apps).toBeFocused();
            await page.keyboard.press("Enter");
          }
          await expect(apps).toHaveAttribute("aria-expanded", "true");
          const mcp = nav.locator('a[href="/usage/mcp"]');
          const home = nav.locator('a[href="/"]').first();
          const state = {
            mcpNamed: await mcp
              .getByText(
                locale === "en-us" ? "AI assistants (MCP)" : "AI 助手（MCP）",
                { exact: true },
              )
              .isVisible(),
            homeNamed: await home
              .getByText(locale === "en-us" ? "Home" : "首页", { exact: true })
              .isVisible(),
            hintCount: await nav.locator("[data-shell-nav-hint]").count(),
            distinctChineseGroup:
              locale !== "zh-cn" ||
              (await nav
                .getByRole("button", { name: "活动", exact: true })
                .count()) === 1,
          };
          expect.soft(state).toEqual({
            mcpNamed: true,
            homeNamed: true,
            hintCount: 7,
            distinctChineseGroup: true,
          });
          // On the unchanged baseline the assertion above fails after all captures
          // and real account observations are retained. No missing control is accepted.
          if (state.hintCount === 7) {
            const summaries = nav.locator("[data-shell-nav-hint] > summary");
            for (const summary of await summaries.all()) {
              const prior = page.url();
              await summary.focus();
              await expect(summary).toBeFocused();
              await page.keyboard.press("Enter");
              const details = summary.locator("..");
              await expect(details).toHaveAttribute("open", "");
              const explanation = details.locator("[data-shell-nav-hint-body]");
              await expect(explanation).toBeVisible();
              await explanation.scrollIntoViewIfNeeded();
              await expect(explanation).toBeInViewport({ ratio: 1 });
              expect(page.url()).toBe(prior);
              await summary.click();
              await expect(details).not.toHaveAttribute("open", "");
              if (width === 390) {
                const box = await summary.boundingBox();
                expect(box?.height).toBeGreaterThanOrEqual(44);
                expect(box?.width).toBeGreaterThanOrEqual(44);
              }
            }
            const mcpInfo = nav.locator("[data-shell-nav-hint]").filter({
              has: page.locator("summary:not([data-shell-count-value])"),
            });
            await mcpInfo.locator("summary").click();
            await expect(
              mcpInfo.locator("[data-shell-nav-hint-body]"),
            ).toContainText(
              locale === "en-us" ? "Personal data requires" : "个人数据需",
            );
            await mcpInfo
              .locator("[data-shell-nav-hint-body]")
              .scrollIntoViewIfNeeded();
            await expect(
              mcpInfo.locator("[data-shell-nav-hint-body]"),
            ).toBeInViewport({ ratio: 1 });
            await info.attach(`discovery-hints-${locale}-${width}`, {
              body: await page.screenshot(),
              contentType: "image/png",
            });
            await mcpInfo.locator("summary").click();
            // Audit the real loaded badges as well as the navigation-time shell.
            await expectRenderedUiQuality(page);
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
              expect(await page.getByRole("menu").count()).toBeLessThanOrEqual(
                1,
              );
              if (!(await page.getByRole("menu").count())) {
                await visibleAccount.focus();
                await page.keyboard.press("Enter");
              }
              await expect(page.getByRole("menu")).toHaveCount(1);
              await page
                .getByRole("menuitem", { name: "Settings", exact: true })
                .focus();
              await page.keyboard.press("Enter");
              await waitForUiSettled(page);
              await expect(page).toHaveURL(/\/account\/settings\/preferences$/);
              await expect(page.getByRole("menu")).toHaveCount(0);
            }
          }
        });
      },
    );
  }
}

test(
  "shell.discovery late real counts keep the active settings destination readable",
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
      preferenceFlow.onClosing(() => {
        release.resolve();
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
          }
        },
      );
      try {
        await Promise.all([
          page.goto("/account/settings/danger", {
            waitUntil: "domcontentloaded",
          }),
          captured.promise,
        ]);
        await page.waitForFunction(
          () => document.documentElement.dataset.lifeUstcHydrated === "true",
        );
        await expect(
          page.getByRole("heading", {
            level: 1,
            name: "Danger zone",
            exact: true,
          }),
        ).toBeVisible();
        await page
          .locator('[data-shell-topbar] [data-slot="sidebar-trigger"]')
          .click();
        const nav = page.getByTestId("settings-sidebar");
        const active = nav.locator('a[aria-current="page"]');
        const sheet = page.locator(
          '[data-slot="sidebar"][data-mobile="true"][role="dialog"]',
        );
        await expect(sheet).toBeVisible();
        await expect(active).toBeVisible();
        await expect(active).toHaveAttribute(
          "href",
          "/account/settings/danger",
        );
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
        const activity = nav.locator(
          'a[data-slot="sidebar-menu-button"][href="/workspace/subscriptions/activities?view=notifications"]',
        );
        const row = activity.locator(
          'xpath=ancestor::*[@data-slot="sidebar-menu-item"][1]',
        );
        await expect(
          row.locator("summary[data-shell-count-value]"),
        ).toHaveCount(0);
        const response = preferenceFlow.waitForResponse(page, (res) =>
          res.url().endsWith("/_internal/shell-bootstrap"),
        );
        release.resolve();
        await response;
        await expect(sheet).toBeVisible();
        await expect(active).toBeVisible();
        const summary = row.locator("summary[data-shell-count-value]");
        await expect(summary).toBeVisible();
        await expect(summary).toHaveAttribute("data-shell-count-value", "1");
        await expect(summary).toHaveText("1 unread");
        await expect.poll(activeVisible).toBe(true);
        const label = activity.locator(":scope > span:last-child");
        await expect(label).toBeVisible();
        await expect(label).toHaveText("Activity subscriptions");
        const readable = await row.evaluate((element) => {
          const a = element.querySelector('a[data-slot="sidebar-menu-button"]');
          const label = a?.querySelector(":scope > span:last-child"),
            summary = element.querySelector("summary[data-shell-count-value]");
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
        const sheet = page.locator(
          '[data-slot="sidebar"][data-mobile="true"][role="dialog"]',
        );
        if (
          !page.isClosed() &&
          (await sheet.count()) === 1 &&
          (await sheet.isVisible())
        )
          await sheet.screenshot({
            path: info.outputPath("late-count-settings-390.png"),
          });
      }
    });
  },
);
