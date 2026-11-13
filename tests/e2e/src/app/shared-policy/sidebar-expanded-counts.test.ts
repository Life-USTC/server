import { expect } from "@playwright/test";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../utils/page-ready";
import { test } from "../../../utils/personal-preferences-fixture";

for (const [locale, width] of [
  ["en-us", 1280],
  ["zh-cn", 390],
] as const) {
  for (const isAdmin of [false, true]) {
    test(`sidebar.expanded current tree ${isAdmin ? "admin" : "normal"} ${locale}`, {
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
                courses: false,
                campus: false,
                activities: false,
                account: false,
                apps: false,
                admin: false,
              },
              submenus: {
                settings: false,
                adminModeration: false,
                youngEvents: false,
                youngOrganizers: false,
              },
            }),
          ),
        );
        await gotoAndWaitForReady(
          page,
          isAdmin
            ? "/admin/users?search=sidebar-case"
            : `/catalog/sections/${fixture.section.jwId}`,
        );
        if (width === 390)
          await page
            .getByRole("button", {
              name: menuName,
              exact: true,
            })
            .click();
        const nav = page.locator(
          `[data-shell-navigation="${width === 390 ? "mobile" : "desktop"}"]`,
        );
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
          path: `/tmp/life-four-primary-expanded-${isAdmin ? "admin" : "normal"}-${locale}-${width}-legacy-top.png`,
        });
        await expect(
          nav.locator(
            'button[aria-expanded], [data-slot="sidebar-menu-action"], details, summary, [data-shell-nav-hint]',
          ),
        ).toHaveCount(0);
        if (isAdmin) {
          await nav.locator('a[href="/admin/moderation"]').click();
          await expect(page).toHaveURL(/\/admin\/moderation$/);
          await waitForUiSettled(page);
          if (width === 390)
            await page
              .getByRole("button", { name: menuName, exact: true })
              .click();
          await expect(nav).toHaveAttribute(
            "data-shell-navigation-view",
            "admin-queues",
          );
          for (const queue of [
            "comments",
            "descriptions",
            "homeworks",
            "suspensions",
          ])
            await expect(
              nav.locator(`a[href="/admin/moderation?tab=${queue}"]`),
            ).toBeVisible();
        } else {
          const hrefs = [
            "/workspace/calendar",
            "/workspace/homeworks",
            "/workspace/todos",
            "/workspace/exams",
            "/workspace/subscriptions",
            "/workspace/subscriptions/activities?view=notifications",
          ];
          for (const [index, href] of hrefs.entries()) {
            if (index === 0 || index === 1) {
              await gotoAndWaitForReady(
                page,
                index === 0 ? "/workspace/calendar" : "/workspace/todos",
              );
              if (width === 390)
                await page
                  .getByRole("button", { name: menuName, exact: true })
                  .click();
              await expect(nav).toHaveAttribute(
                "data-shell-navigation-view",
                index === 0 ? "calendar" : "workspace",
              );
            }
            const link = nav.locator(
              `a[data-sidebar="menu-button"][href="${href}"]`,
            );
            const badge = link
              .locator('xpath=ancestor::*[@data-slot="sidebar-menu-item"][1]')
              .locator("[data-shell-count-value]");
            const value = [4, 1, 2, 1, 1, 1][index];
            await expect(badge).toHaveText(String(value));
            await expect(badge).toHaveAttribute(
              "data-shell-count-value",
              String(value),
            );
            await expect(badge).toHaveRole("img");
            const scopes =
              locale === "en-us"
                ? [
                    "not this view",
                    "Teaching-assistant",
                    "undated and overdue",
                    "today",
                    "historical and retired",
                    "not expired",
                  ]
                : [
                    "非当前视图",
                    "助教订阅",
                    "未定日期和已逾期",
                    "今日",
                    "历史及已退役",
                    "未过期",
                  ];
            await expect(badge).toHaveAccessibleName(
              new RegExp(`${value} .*${scopes[index]}`),
            );
            const geometry = await link
              .locator('xpath=ancestor::*[@data-slot="sidebar-menu-item"][1]')
              .evaluate((row) => {
                const label = row.querySelector(
                  'a[data-sidebar="menu-button"] > span:last-child',
                );
                const count = row.querySelector("[data-shell-count-value]");
                if (
                  !(label instanceof HTMLElement) ||
                  !(count instanceof HTMLElement)
                )
                  throw new Error("Missing readable count/label");
                const labelRect = label.getBoundingClientRect();
                const countRect = count.getBoundingClientRect();
                return {
                  labelRight: labelRect.right,
                  countLeft: countRect.left,
                  labelCentreY: labelRect.top + labelRect.height / 2,
                  countCentreY: countRect.top + countRect.height / 2,
                  labelWidth: label.clientWidth,
                  labelScrollWidth: label.scrollWidth,
                };
              });
            expect(geometry.labelRight).toBeLessThanOrEqual(geometry.countLeft);
            expect(
              Math.abs(geometry.labelCentreY - geometry.countCentreY),
            ).toBeLessThanOrEqual(0.5);
            expect(geometry.labelScrollWidth).toBeLessThanOrEqual(
              geometry.labelWidth,
            );
          }
        }
        if (!isAdmin) {
          await gotoAndWaitForReady(page, "/usage/mcp");
          if (width === 390)
            await page
              .getByRole("button", { name: menuName, exact: true })
              .click();
          await expect(nav).toHaveAttribute(
            "data-shell-navigation-view",
            "apps",
          );
          const link = nav.locator('a[href="/usage/mcp"]');
          await expect(link).toBeVisible();
        }
        await scroll.evaluate((node) => {
          node.scrollTop = 0;
        });
        await page.screenshot({
          path: `/tmp/life-four-primary-expanded-${isAdmin ? "admin" : "normal"}-${locale}-${width}-expanded-top.png`,
        });
        await scroll.evaluate((node) => {
          node.scrollTop = node.scrollHeight;
        });
        await page.screenshot({
          path: `/tmp/life-four-primary-expanded-${isAdmin ? "admin" : "normal"}-${locale}-${width}-expanded-bottom.png`,
        });
        await page.reload();
        await gotoAndWaitForReady(
          page,
          isAdmin
            ? "/admin/users?search=sidebar-case"
            : `/catalog/sections/${fixture.section.jwId}`,
        );
        if (width === 390)
          await page
            .getByRole("button", {
              name: menuName,
              exact: true,
            })
            .click();
        await expect(
          nav.locator(
            'button[aria-expanded], [data-slot="sidebar-menu-action"]',
          ),
        ).toHaveCount(0);
        if (isAdmin) {
          await nav.locator('a[href="/admin/moderation"]').click();
          await expect(page).toHaveURL(/\/admin\/moderation$/);
          await waitForUiSettled(page);
          if (width === 390)
            await page
              .getByRole("button", { name: menuName, exact: true })
              .click();
          await expect(
            nav.locator('a[href="/admin/moderation?tab=suspensions"]'),
          ).toBeVisible();
        } else {
          await gotoAndWaitForReady(page, "/usage/mcp");
          if (width === 390)
            await page
              .getByRole("button", { name: menuName, exact: true })
              .click();
          await expect(nav.locator('a[href="/usage/mcp"]')).toBeVisible();
        }
      });
    });
  }
}
