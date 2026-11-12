import { expect } from "@playwright/test";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../utils/page-ready";
import { test } from "../../../utils/personal-preferences-fixture";

const organizerName =
  "校园活动学术交流协作中心 NavigationOrganizerWithoutWhitespaceABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
for (const locale of ["en-us", "zh-cn"] as const) {
  for (const width of [1280, 390]) {
    test(
      `shell.navigation continuity ${locale} ${width}`,
      { tag: "@Site/Web" },
      async ({ page, isolatedWorker, preferenceFlow }, testInfo) => {
        const fixture = await preferenceFlow.prepare(async () => {
          const course = await isolatedWorker.database.owner.course.create({
            data: {
              jwId: 1800142600,
              code: "NAV1426",
              nameCn: "导航连续性课程",
              nameEn: "Navigation continuity course",
            },
          });
          const section = await isolatedWorker.database.owner.section.create({
            data: { jwId: 1800142601, code: "NAV1426.01", courseId: course.id },
          });
          const organizer =
            await isolatedWorker.database.owner.youngOrganizer.create({
              data: {
                id: "navigation-organizer",
                name: organizerName,
                normalizedName: "navigation-organizer",
              },
            });
          await isolatedWorker.database.owner.youngEvent.create({
            data: {
              youngId: "navigation-event",
              name: "Navigation related activity / 导航关联活动",
              organizerId: organizer.id,
              organizer: organizer.name,
              isActive: true,
              startAt: new Date("2029-11-05T06:00:00Z"),
              endAt: new Date("2029-11-05T08:00:00Z"),
              rawJson: {},
            },
          });
          const actor = await isolatedWorker.createActor();
          return { course, section, organizer, actor };
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
          const menu = page.locator(
            '[data-shell-topbar] [data-slot="sidebar-trigger"]',
          );
          const navigation = async () => {
            if (width < 768 && !(await page.getByRole("dialog").isVisible()))
              await menu.click();
            return width < 768
              ? page.getByRole("dialog")
              : page.getByTestId("app-sidebar");
          };
          const filtered =
            "/catalog/young-events/organizers?search=NavigationOrganizerWithoutWhitespace";
          await gotoAndWaitForReady(page, filtered);
          await page
            .locator(
              `main a[href="/catalog/young-events/organizers/${fixture.organizer.id}"]:visible`,
            )
            .click();
          await expect(page).toHaveURL(
            new RegExp(`/organizers/${fixture.organizer.id}$`),
          );
          await waitForUiSettled(page);
          let nav = await navigation();
          if (width < 768) {
            await expect(nav).toHaveAccessibleName(
              locale === "en-us" ? "Second Classroom" : "第二课堂",
            );
            await expect(nav).toHaveAccessibleDescription(
              locale === "en-us" ? "Menu" : "菜单",
            );
          }
          const current = nav.locator('a[aria-current="page"]');
          await expect(current).toHaveText(organizerName);
          await expect(current).toHaveAttribute(
            "href",
            `/catalog/young-events/organizers/${fixture.organizer.id}`,
          );
          const viewport = nav.locator('[data-slot="sidebar-content"]');
          await expect
            .poll(async () => {
              const item = await current.boundingBox();
              const region = await viewport.boundingBox();
              return Boolean(
                item &&
                  region &&
                  item.y >= region.y - 1 &&
                  item.y + item.height <= region.y + region.height + 1 &&
                  item.x >= region.x - 1 &&
                  item.x + item.width <= region.x + region.width + 1,
              );
            })
            .toBe(true);
          expect(
            await current.evaluate(
              (node) => node.scrollWidth <= node.clientWidth + 1,
            ),
          ).toBe(true);
          await page.evaluate(() => document.fonts.ready);
          await page.screenshot({
            path: testInfo.outputPath(`organizer-${locale}-${width}.png`),
          });
          if (width < 768) {
            const close = nav.getByRole("button", {
              name: locale === "en-us" ? "Close navigation" : "关闭导航",
              exact: true,
            });
            const box = await close.boundingBox();
            expect(box?.width).toBeGreaterThanOrEqual(44);
            expect(box?.height).toBeGreaterThanOrEqual(44);
            const scroll = await page.evaluate(() => scrollY);
            await close.focus();
            await page.keyboard.press("Enter");
            await expect(menu).toBeFocused();
            expect(await page.evaluate(() => scrollY)).toBe(scroll);
            await navigation();
            await page.keyboard.press("Escape");
            await expect(menu).toBeFocused();
          } else {
            await page.evaluate(() => {
              const key = "life-ustc.sidebar.v1";
              const old = JSON.parse(localStorage.getItem(key) ?? "{}");
              localStorage.setItem(
                key,
                JSON.stringify({
                  ...old,
                  groups: { apps: false, activities: false },
                  submenus: { youngEvents: false, youngOrganizers: false },
                }),
              );
            });
            await page.reload();
            await waitForUiSettled(page);
            await expect(nav.locator('a[href="/usage/mcp"]')).toBeVisible();
            await expect(nav.locator("button[aria-expanded]")).toHaveCount(0);
            await expect(current).toHaveText(organizerName);
            await page.locator('[data-slot="sidebar-rail"]').click();
            const ancestor = nav.locator('button[aria-current="location"]');
            const name = locale === "en-us" ? "Activities" : "活动";
            await expect(ancestor).toHaveAccessibleName(
              `${locale === "en-us" ? "Expand sidebar" : "展开侧边栏"}: ${name}`,
            );
            await expect(ancestor).toHaveAttribute(
              "title",
              `${locale === "en-us" ? "Expand sidebar" : "展开侧边栏"}: ${name}`,
            );
            await expect(ancestor).toHaveAttribute("data-active", "true");
            await ancestor.focus();
            await page.keyboard.press("Enter");
            await expect(current).toBeVisible();
          }
          const marker = crypto.randomUUID();
          await page.evaluate((value) => {
            (
              window as Window & { navigationContinuity?: string }
            ).navigationContinuity = value;
          }, marker);
          await page
            .locator(
              'main a[href="/catalog/young-events/navigation-event"]:visible',
            )
            .click();
          await expect(page).toHaveURL(
            /\/catalog\/young-events\/navigation-event$/,
          );
          await waitForUiSettled(page);
          nav = await navigation();
          await expect(nav.locator('a[aria-current="page"]')).toHaveAttribute(
            "href",
            "/catalog/young-events/navigation-event",
          );
          if (width < 768) {
            await page.keyboard.press("Escape");
            await expect(menu).toBeFocused();
          }
          await page.goBack();
          await waitForUiSettled(page);
          await expect(page.getByRole("heading", { level: 1 })).toHaveText(
            organizerName,
          );
          await page.goBack();
          await waitForUiSettled(page);
          await expect(page).toHaveURL(
            new URL(filtered, isolatedWorker.origin).toString(),
          );
          expect(
            await page.evaluate(
              () =>
                (window as Window & { navigationContinuity?: string })
                  .navigationContinuity,
            ),
          ).toBe(marker);
          await expect(
            page.locator(
              'main a[href="/catalog/young-events/organizers/navigation-organizer"]:visible',
            ),
          ).toHaveCount(1);

          await gotoAndWaitForReady(
            page,
            `/catalog/sections/${fixture.section.jwId}`,
          );
          const directory = page.getByTestId("shell-detail-navigation");
          await expect(
            directory.getByTestId("section-course-link"),
          ).toHaveAttribute("href", `/catalog/courses/${fixture.course.jwId}`);
          await expect(directory.locator('[aria-current="page"]')).toHaveText(
            locale === "en-us"
              ? "Navigation continuity course"
              : "导航连续性课程",
          );
          expect(
            await directory
              .locator('[data-slot="page-section-nav"] a')
              .evaluateAll((nodes) =>
                nodes.map((node) => node.getAttribute("href")),
              ),
          ).toEqual([
            "#introduction",
            "#calendar",
            "#exams",
            "#homework",
            "#comments",
            "#overview",
          ]);
          await page.screenshot({
            path: testInfo.outputPath(`section-${locale}-${width}.png`),
          });
          if (width === 1280) {
            const academicNav = await navigation();
            await expect(
              academicNav.locator('a[aria-current="page"]'),
            ).toHaveAttribute(
              "href",
              `/catalog/sections/${fixture.section.jwId}`,
            );
            await page.locator('[data-slot="sidebar-rail"]').click();
            const ancestor = academicNav.locator(
              'button[aria-current="location"]',
            );
            const name = locale === "en-us" ? "Courses" : "课程";
            await expect(ancestor).toHaveAccessibleName(
              `${locale === "en-us" ? "Expand sidebar" : "展开侧边栏"}: ${name}`,
            );
            await expect(ancestor).toHaveAttribute(
              "title",
              `${locale === "en-us" ? "Expand sidebar" : "展开侧边栏"}: ${name}`,
            );
            await expect(ancestor).toHaveAttribute("data-active", "true");
            await ancestor.focus();
            await page.keyboard.press("Enter");
          }
          await directory.locator('a[href="#comments"]').click();
          await expect(page).toHaveURL(/#comments$/);
          await expect(page.locator("#comments h2")).toBeInViewport();
          if (width === 1280) {
            expect(await page.evaluate(() => scrollY)).toBe(0);
            expect(
              await page
                .locator("[data-detail-scroll-container]")
                .evaluate((node) => node.scrollTop),
            ).toBeGreaterThan(0);
          }
          await page.reload();
          await waitForUiSettled(page);
          await expect(page.locator("#comments h2")).toBeInViewport();
          await page.getByTestId("section-course-link").click();
          await expect(page).toHaveURL(
            new RegExp(`/catalog/courses/${fixture.course.jwId}$`),
          );
          await waitForUiSettled(page);
          expect(
            await page
              .getByTestId("shell-detail-navigation")
              .locator('[data-slot="page-section-nav"] a')
              .evaluateAll((nodes) =>
                nodes.map((node) => node.getAttribute("href")),
              ),
          ).toEqual(["#introduction", "#sections", "#comments", "#overview"]);
          await page
            .getByTestId("shell-detail-navigation")
            .locator('a[href="#sections"]')
            .click();
          await expect(page.locator("#sections h2")).toBeInViewport();

          await gotoAndWaitForReady(page, "/account/settings/profile");
          nav = await navigation();
          await expect(
            nav.locator('[data-shell-legal-nav] a[href="/privacy"]'),
          ).toBeVisible();
          await expect(
            nav.locator('[data-shell-legal-nav] a[href="/terms"]'),
          ).toBeVisible();
          await expect(
            nav.locator('a[href="/catalog/sections"]'),
          ).toBeVisible();
          await page.screenshot({
            path: testInfo.outputPath(`settings-${locale}-${width}.png`),
          });
          // Workspace uses the same sidebar legal capability as settings.
          if (width < 768) await page.keyboard.press("Escape");
          await gotoAndWaitForReady(page, "/workspace/todos");
          const workspaceNav = await navigation();
          await expect(
            workspaceNav.locator('[data-shell-legal-nav] a[href="/privacy"]'),
          ).toBeVisible();
          if (width < 768) await page.keyboard.press("Escape");
          await gotoAndWaitForReady(page, "/account/settings/profile");
          nav = await navigation();
          await nav
            .locator('[data-shell-legal-nav] a[href="/privacy"]')
            .click();
          await expect(page).toHaveURL(/\/privacy$/);
          await waitForUiSettled(page);
          if (width < 768)
            await expect(page.getByRole("dialog")).toHaveCount(0);
          nav = await navigation();
          await nav.locator('a[href="/catalog/sections"]').click();
          await expect(page).toHaveURL(/\/catalog\/sections$/);
          await waitForUiSettled(page);
          if (width < 768) {
            await expect(page.getByRole("dialog")).toHaveCount(0);
            expect(
              await page.evaluate(() =>
                Boolean(document.activeElement?.closest('[role="dialog"]')),
              ),
            ).toBe(false);
          }
        });
      },
    );
  }
}

for (const mode of [
  "scroll",
  "new-anchor",
  "same-anchor",
  "same-anchor-keyboard",
  "keyboard-input",
] as const) {
  test(`shell.anchor late viewer respects ${mode}`, {
    tag: "@Site/Web",
  }, async ({ page, isolatedWorker, preferenceFlow }) => {
    const section = await preferenceFlow.prepare(async () => {
      const course = await isolatedWorker.database.owner.course.create({
        data: {
          jwId: 1800142620,
          code: "ANCHOR1426",
          nameCn: "锚点恢复课程",
          nameEn: "Anchor restoration course",
        },
      });
      return isolatedWorker.database.owner.section.create({
        data: { jwId: 1800142621, code: "ANCHOR.01", courseId: course.id },
      });
    });
    await preferenceFlow.run(async () => {
      await page.setViewportSize({ width: 1280, height: 950 });
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      preferenceFlow.onClosing(release);
      const requested = preferenceFlow.waitForRequest(
        page.context(),
        (request) => request.url().endsWith("/_internal/shell-bootstrap"),
      );
      await preferenceFlow.route(
        page,
        "**/_internal/shell-bootstrap",
        async (route) => {
          await gate;
          await route.continue();
        },
      );
      try {
        await page.goto(`/catalog/sections/${section.jwId}#comments`, {
          waitUntil: "domcontentloaded",
        });
        await requested;
        await page.waitForFunction(
          () => document.documentElement.dataset.lifeUstcHydrated === "true",
        );
        const inner = page.locator("[data-detail-scroll-container]");
        // Public lazy modules settle independently of the held personal bootstrap.
        for (const [id, empty] of [
          ["introduction", "No description yet"],
          ["calendar", "No schedule or exam events available for this section"],
          ["exams", "No exam arrangements available yet"],
          ["homework", "No homework listed."],
          ["comments", "No comments yet"],
        ] as const)
          await expect(
            page.locator(`#${id}`).getByTestId("compact-empty"),
          ).toContainText(empty);
        await expect(
          page.locator('#comments [data-slot="skeleton"]'),
        ).toHaveCount(0);
        if (mode === "scroll") {
          await inner.hover();
          await page.mouse.wheel(0, -10000);
          await expect
            .poll(() => inner.evaluate((node) => node.scrollTop))
            .toBe(0);
        } else if (mode === "new-anchor") {
          await page
            .getByTestId("shell-detail-navigation")
            .locator('a[href="#introduction"]')
            .click();
          await expect(page).toHaveURL(/#introduction$/);
        } else if (mode === "keyboard-input") {
          // Arrange the read position without dispatching an already-covered
          // wheel/Home cancellation; the new intent comes only from keyboard.
          await inner.evaluate((node) => {
            node.scrollTop = 0;
          });
          await page.keyboard.press("Control+k");
          await expect(
            page.locator("#global-search-dialog-input"),
          ).toBeFocused();
          await page.keyboard.type("Anchor");
        } else {
          const anchor = page
            .getByTestId("shell-detail-navigation")
            .locator('a[href="#comments"]');
          if (mode === "same-anchor-keyboard") {
            await inner.hover();
            await page.mouse.wheel(0, -10000);
            await expect
              .poll(() => inner.evaluate((node) => node.scrollTop))
              .toBe(0);
            await anchor.focus();
            await page.keyboard.press("Enter");
          } else await anchor.click();
          await expect(page).toHaveURL(/#comments$/);
        }
        const response = preferenceFlow.waitForResponse(page, (res) =>
          res.url().endsWith("/_internal/shell-bootstrap"),
        );
        release();
        await response;
        await waitForUiSettled(page);
        if (mode === "scroll") {
          await expect
            .poll(() => inner.evaluate((node) => node.scrollTop))
            .toBe(0);
          await expect(page.locator("#comments h2")).not.toBeInViewport();
        } else if (mode === "new-anchor") {
          await expect(page).toHaveURL(/#introduction$/);
          await expect(page.locator("#introduction h2")).toBeInViewport();
        } else if (mode === "keyboard-input") {
          await expect(page.locator("#global-search-dialog-input")).toHaveValue(
            "Anchor",
          );
          await expect(
            page.locator("#global-search-dialog-input"),
          ).toBeFocused();
          await expect
            .poll(() => inner.evaluate((node) => node.scrollTop))
            .toBe(0);
        } else {
          await expect(page).toHaveURL(/#comments$/);
          await expect(page.locator("#comments h2")).toBeInViewport();
        }
      } finally {
        release();
      }
    });
  });
}

for (const [locale, width] of [
  ["en-us", 1280],
  ["zh-cn", 390],
] as const) {
  test(`shell.teacher canonical collection and in-page contents ${locale}`, {
    tag: "@Site/Web",
  }, async ({ page, isolatedWorker, preferenceFlow }) => {
    const { teacher, section } = await preferenceFlow.prepare(async () => {
      const db = isolatedWorker.database.owner;
      const course = await db.course.create({
        data: {
          jwId: 1800142640,
          code: "RELATED1426",
          nameCn: "关联课程",
          nameEn: "Related course",
        },
      });
      const teacher = await db.teacher.create({
        data: {
          jwId: 1800142641,
          nameCn: "导航教师",
          nameEn: "Navigation teacher",
        },
      });
      const section = await db.section.create({
        data: {
          jwId: 1800142642,
          code: "RELATED.01",
          courseId: course.id,
          teachers: { connect: { id: teacher.id } },
        },
      });
      return { teacher, section };
    });
    await preferenceFlow.run(async () => {
      await page.setViewportSize({ width, height: 950 });
      await page
        .context()
        .addCookies([
          { name: "NEXT_LOCALE", value: locale, url: isolatedWorker.origin },
        ]);
      await gotoAndWaitForReady(page, `/catalog/sections/${section.jwId}`);
      const relation = page.locator(
        `#teachers a[href="/catalog/teachers/${teacher.id}"]`,
      );
      await expect(relation).toBeVisible();
      await relation.click();
      await expect(page).toHaveURL(
        new RegExp(`/catalog/teachers/${teacher.id}$`),
      );
      await waitForUiSettled(page);
      const directory = page.getByTestId("shell-detail-navigation");
      await expect(
        directory.locator("nav").first().locator("a"),
      ).toHaveAttribute("href", "/catalog/teachers");
      await expect(directory.locator('[aria-current="page"]')).toHaveText(
        locale === "en-us" ? "Navigation teacher" : "导航教师",
      );
      expect(
        await directory
          .locator('[data-slot="page-section-nav"] a')
          .evaluateAll((nodes) =>
            nodes.map((node) => node.getAttribute("href")),
          ),
      ).toEqual(["#introduction", "#sections", "#comments", "#overview"]);
      await directory.locator('a[href="#sections"]').click();
      await expect(page.locator("#sections h2")).toBeInViewport();
      await expect(
        page
          .locator(
            `#sections a[href="/catalog/sections/${section.jwId}"]:visible`,
          )
          .first(),
      ).toBeVisible();
      await page.reload();
      await waitForUiSettled(page);
      await expect(page.locator("#sections h2")).toBeInViewport();
    });
  });
}
