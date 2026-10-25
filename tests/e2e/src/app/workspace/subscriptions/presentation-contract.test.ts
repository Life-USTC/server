import { expect, type Page } from "@playwright/test";
import {
  expectNoPageHorizontalOverflow,
  gotoAndWaitForReady,
} from "../../../../utils/page-ready";
import { expectRenderedUiQuality } from "../../../../utils/ui-quality";
import { test } from "./presentation-fixture";

const widths = [1280, 390];

for (const locale of ["zh-cn", "en-us"] as const) {
  for (const width of widths) {
    test(`subscription.table-filters-apply-across-semesters ${locale} ${width}`, {
      tag: "@Subscription/Web",
    }, async ({
      page,
      presentation,
      isolatedWorker,
      catalogSubscriptionRun,
      run,
    }) => {
      test.setTimeout(60_000);
      const { user, sections, semesters, course, teacher } = presentation;
      const englishCourseName = course.nameEn;
      const englishTeacherName = teacher.nameEn;
      if (!englishCourseName || !englishTeacherName)
        throw new Error("Expected bilingual subscription filter fixtures");
      await run(async () => {
        for (const [section, kind] of [
          [sections[1], "auditor"],
          [sections[2], "teaching_assistant"],
        ] as const) {
          await isolatedWorker.database.owner.userSectionSubscription.update({
            where: {
              userId_sectionId: { userId: user.id, sectionId: section.id },
            },
            data: { kind },
          });
        }
      });
      const text =
        locale === "zh-cn"
          ? {
              apply: "应用筛选",
              semester: "学期",
              course: "课程名称",
              code: "教学班",
              teacher: "教师",
              credits: "学分",
              regular: "普通",
              assistant: "助教",
              maximum: "上限",
              semesters: semesters.map(({ nameCn }) => nameCn),
              courseName: course.nameCn,
              teacherName: teacher.nameCn,
            }
          : {
              apply: "Apply filters",
              semester: "Semester",
              course: "Course Name",
              code: "Section",
              teacher: "Teachers",
              credits: "Credits",
              regular: "Regular",
              assistant: "Teaching assistant",
              maximum: "Upper bound",
              semesters: ["Spring 2026", "Fall 2025"],
              courseName: englishCourseName,
              teacherName: englishTeacherName,
            };
      await catalogSubscriptionRun(
        user,
        { calendarMessages: [], calendarTokenCreated: true },
        async () => {
          await page.context().addCookies([
            (await isolatedWorker.createSession(user.id)).cookie,
            {
              name: "NEXT_LOCALE",
              value: locale,
              url: isolatedWorker.origin,
            },
          ]);
          await open(page, width);
          const filters = page.locator("#subscriptions-filters");
          const groups = page
            .getByTestId("subscription-semester-groups")
            .locator(":scope > section");
          const links = page
            .getByTestId("subscription-course-link")
            .filter({ visible: true });
          const apply = page.getByRole("button", {
            name: text.apply,
            exact: true,
          });
          await expect(filters).toHaveCount(1);
          await expect(apply).toHaveCount(1);
          for (const name of [
            text.semester,
            text.course,
            text.teacher,
            text.credits,
          ]) {
            await expect(
              page.getByRole("button", { name, exact: true }),
            ).toHaveCount(1);
            await expect(
              filters.getByRole("button", { name, exact: true }),
            ).toBeVisible();
          }
          const buttons = await filters
            .getByRole("button")
            .evaluateAll((nodes) =>
              nodes.map((node) => {
                const { left, right, top, bottom } =
                  node.getBoundingClientRect();
                return {
                  label: node.textContent?.trim(),
                  left,
                  right,
                  top,
                  bottom,
                };
              }),
            );
          for (const [index, first] of buttons.entries()) {
            for (const second of buttons.slice(index + 1)) {
              expect(
                first.right <= second.left ||
                  second.right <= first.left ||
                  first.bottom <= second.top ||
                  second.bottom <= first.top,
                `Filter buttons ${first.label} and ${second.label} must not overlap`,
              ).toBe(true);
            }
          }
          await expect(
            groups.locator('form, [data-slot="table-column-header"]'),
          ).toHaveCount(0);
          await expect(
            page
              .getByTestId("subscription-semester-table")
              .locator("thead button"),
          ).toHaveCount(0);
          await expect(groups).toHaveCount(2);
          const toolbarBox = await filters.boundingBox();
          const groupBox = await groups.first().boundingBox();
          if (!toolbarBox || !groupBox)
            throw new Error("Expected visible filters and semester groups");
          expect(toolbarBox.y + toolbarBox.height).toBeLessThanOrEqual(
            groupBox.y,
          );
          await expect(links).toHaveCount(3);
          const semesterTrigger = filters.getByRole("button", {
            name: text.semester,
            exact: true,
          });
          await semesterTrigger.click();
          const semester = page.locator('[data-filter-field="semester"]');
          await semester
            .getByRole("checkbox", { name: text.semesters[0], exact: true })
            .check();
          await page.keyboard.press("Escape");
          const credits = filters.getByRole("button", {
            name: text.credits,
            exact: true,
          });
          await credits.click();
          const dialog = page.getByRole("dialog", {
            name: text.credits,
            exact: true,
          });
          await dialog.getByRole("combobox").selectOption("gte");
          await dialog.getByRole("spinbutton").fill("2.5");
          await expect(
            dialog.getByRole("button", { name: text.apply, exact: true }),
          ).toHaveCount(0);
          await page.keyboard.press("Escape");
          await expect(links).toHaveCount(3);
          await apply.click();
          await expect(links).toHaveCount(2);
          await expect(groups).toHaveCount(1);
          await expect(
            page
              .locator(
                `a[data-testid="subscription-course-link"][href="/catalog/sections/${sections[2].jwId}"]`,
              )
              .filter({ visible: true }),
          ).toHaveCount(0);
          await semesterTrigger.click();
          await semester
            .getByRole("checkbox", { name: text.semesters[1], exact: true })
            .check();
          await page.keyboard.press("Escape");
          await apply.click();
          await expect(links).toHaveCount(3);
          await expect(groups).toHaveCount(2);

          const teacherTrigger = filters.getByRole("button", {
            name: text.teacher,
            exact: true,
          });
          await teacherTrigger.click();
          const teacherField = page.locator('[data-filter-field="teacher"]');
          await teacherField
            .getByRole("checkbox", { name: text.teacherName, exact: true })
            .check();
          await page.keyboard.press("Escape");
          const courseTrigger = filters.getByRole("button", {
            name: text.course,
            exact: true,
          });
          await courseTrigger.click();
          const courseDialog = page.getByRole("dialog", {
            name: text.course,
            exact: true,
          });
          await courseDialog
            .getByRole("textbox", { name: text.course, exact: true })
            .fill(text.courseName);
          await courseDialog
            .getByRole("checkbox", { name: text.regular, exact: true })
            .check();
          await courseDialog
            .getByRole("checkbox", { name: text.assistant, exact: true })
            .check();
          await page.keyboard.press("Escape");
          await expect(links).toHaveCount(3);
          await apply.click();
          await expect(links).toHaveCount(2);
          expect(
            await links.evaluateAll((items) =>
              items.map((item) => item.getAttribute("href")),
            ),
          ).toEqual([
            `/catalog/sections/${sections[0].jwId}`,
            `/catalog/sections/${sections[2].jwId}`,
          ]);
          await expect(groups).toHaveCount(2);
          await courseTrigger.click();
          await courseDialog
            .getByRole("textbox", { name: text.code, exact: true })
            .fill(sections[2].code);
          await page.keyboard.press("Escape");
          await apply.click();
          await expect(links).toHaveCount(1);
          await expect(links).toHaveAttribute(
            "href",
            `/catalog/sections/${sections[2].jwId}`,
          );
          await expect(groups).toHaveCount(1);

          await credits.click();
          await dialog.getByRole("combobox").selectOption("between");
          await dialog
            .getByRole("spinbutton", { name: text.credits, exact: true })
            .fill("2.5");
          await dialog
            .getByRole("spinbutton", { name: text.maximum, exact: true })
            .fill("2.5");
          await page.keyboard.press("Escape");
          await apply.click();
          await expect(links).toHaveCount(1);
          await credits.click();
          await dialog.getByRole("combobox").selectOption("gt");
          await page.keyboard.press("Escape");
          await apply.click();
          await expect(links).toHaveCount(0);
          await expect(groups).toHaveCount(0);
          for (const name of [
            text.semester,
            text.course,
            text.teacher,
            text.credits,
          ])
            await expect(
              filters.getByRole("button", { name, exact: true }),
            ).toBeVisible();
          await credits.click();
          await dialog.getByRole("spinbutton").fill("");
          await page.keyboard.press("Escape");
          await courseTrigger.click();
          await courseDialog
            .getByRole("textbox", { name: text.course, exact: true })
            .fill("");
          await courseDialog
            .getByRole("textbox", { name: text.code, exact: true })
            .fill("");
          await courseDialog
            .getByRole("checkbox", { name: text.regular, exact: true })
            .uncheck();
          await courseDialog
            .getByRole("checkbox", { name: text.assistant, exact: true })
            .uncheck();
          await page.keyboard.press("Escape");
          await teacherTrigger.click();
          await teacherField
            .getByRole("checkbox", { name: text.teacherName, exact: true })
            .uncheck();
          await page.keyboard.press("Escape");
          await semesterTrigger.click();
          for (const name of text.semesters)
            await semester
              .getByRole("checkbox", { name, exact: true })
              .uncheck();
          await page.keyboard.press("Escape");
          await expect(links).toHaveCount(0);
          await apply.click();
          await expect(links).toHaveCount(3);
          await expect(groups).toHaveCount(2);
          await expectRenderedUiQuality(page);
          await expectNoPageHorizontalOverflow(page);
        },
      );
    });
  }
}

async function open(page: Page, width: number) {
  await page.setViewportSize({ width, height: 844 });
  await gotoAndWaitForReady(page, "/workspace/subscriptions");
}

async function setLocale(
  page: Page,
  locale: string,
  headers: Record<string, string>,
) {
  const response = await page.request.post("/api/account/preferences", {
    headers,
    data: { locale },
  });
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ success: true });
}

test("subscription.subscription-language", {
  tag: "@Subscription/Web",
}, async ({ page, presentation, isolatedWorker, catalogSubscriptionRun }) => {
  const { user, sections } = presentation;
  await catalogSubscriptionRun(
    user,
    {
      calendarMessages: Array.from({ length: 4 }, () => ({
        type: "user" as const,
        userId: user.id,
      })),
      calendarTokenCreated: true,
    },
    async (effects) => {
      await page
        .context()
        .addCookies([
          (await isolatedWorker.createSession(user.id)).cookie,
          { name: "NEXT_LOCALE", value: "zh-cn", url: isolatedWorker.origin },
        ]);
      const db = isolatedWorker.database.owner;
      for (const locale of ["zh-cn", "en-us"]) {
        await setLocale(page, locale, effects.headers);
        await open(page, 1280);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
          locale === "zh-cn" ? "教学班订阅" : "Section Subscriptions",
        );
        await expect(
          page
            .getByRole("button", {
              name:
                locale === "zh-cn"
                  ? "取消订阅教学班"
                  : "Unsubscribe from section",
              exact: true,
            })
            .first(),
        ).toBeVisible();
        const first = page
          .locator(
            `a[data-testid="subscription-course-link"][href="/catalog/sections/${sections[0].jwId}"]`,
          )
          .filter({ visible: true });
        await first.click();
        await page.waitForURL(`**/catalog/sections/${sections[0].jwId}`);
        const unsubscribe = page.getByRole("button", {
          name: /^(取消订阅教学班|Unsubscribe from section)$/,
        });
        await expect(unsubscribe).toBeVisible();
        await unsubscribe.click();
        const confirmation = page.getByRole("alertdialog");
        if (await confirmation.count())
          await confirmation
            .getByRole("button", { name: /确认取消订阅|Unsubscribe|Confirm/i })
            .click();
        await expect(
          page.getByRole("button", {
            name: /^(订阅教学班|Subscribe to section)$/,
          }),
        ).toBeVisible();
        await expect(
          page.getByRole("button", {
            name: /^(Follow|Unfollow|Enroll|Unenroll|关注|取消关注|选课|退课)$/i,
          }),
        ).toHaveCount(0);
        expect(
          await db.userSectionSubscription.findUnique({
            where: {
              userId_sectionId: { userId: user.id, sectionId: sections[0].id },
            },
          }),
        ).toBeNull();
        const response = await page.request.patch(
          "/api/workspace/subscriptions",
          {
            headers: effects.headers,
            data: { sectionIds: [sections[0].id] },
          },
        );
        expect(response.status()).toBe(200);
        expect(await response.json()).toMatchObject({
          addedCount: 1,
          alreadySubscribedCount: 0,
        });
        expect(
          await db.userSectionSubscription.findUniqueOrThrow({
            where: {
              userId_sectionId: { userId: user.id, sectionId: sections[0].id },
            },
          }),
        ).toMatchObject({ kind: "regular" });
      }
    },
  );
});

test("subscription.quick-add-result-bound", {
  tag: "@Subscription/Web",
}, async ({ page, presentation, isolatedWorker, catalogSubscriptionRun }) => {
  const { user, sections, course } = presentation;
  await catalogSubscriptionRun(
    user,
    { calendarMessages: [], calendarTokenCreated: true },
    async (effects) => {
      await page
        .context()
        .addCookies([
          (await isolatedWorker.createSession(user.id)).cookie,
          { name: "NEXT_LOCALE", value: "zh-cn", url: isolatedWorker.origin },
        ]);
      const db = isolatedWorker.database.owner;
      await db.section.createMany({
        data: Array.from({ length: 21 }, (_, index) => ({
          code: `${sections[0].code}-search-${index}`,
          jwId: sections[0].jwId + 100 + index,
          courseId: course.id,
          semesterId: sections[0].semesterId,
        })),
      });
      for (const locale of ["zh-cn", "en-us"]) {
        await setLocale(page, locale, effects.headers);
        for (const width of widths) {
          await open(page, width);
          await page
            .getByRole("button", {
              name: /^(添加教学班订阅|Add Section Subscription)$/i,
            })
            .click();
          const dialog = page.getByRole("dialog");
          await dialog
            .locator("#subscriptions-quick-add-semester")
            .selectOption(String(sections[0].semesterId));
          await dialog
            .locator("#subscriptions-quick-add-code")
            .fill(course.code);
          await dialog.getByRole("button", { name: /^(搜索|Search)$/ }).click();
          await expect(dialog.getByRole("checkbox")).toHaveCount(20);
          await expect(
            dialog.getByText(
              locale === "zh-cn"
                ? "最多显示 20 个教学班，请增加限定条件"
                : "Up to 20 sections are shown. Add more details to narrow your search.",
              { exact: true },
            ),
          ).toBeVisible();
          await page.keyboard.press("Escape");
        }
      }
    },
  );
});

test("subscription.kind-web-editor-location", {
  tag: "@Subscription/Web",
}, async ({ page, presentation, isolatedWorker, catalogSubscriptionRun }) => {
  const { user, sections } = presentation;
  await catalogSubscriptionRun(
    user,
    {
      calendarMessages: Array.from({ length: 12 }, () => ({
        type: "user" as const,
        userId: user.id,
      })),
      calendarTokenCreated: true,
    },
    async (effects) => {
      await page
        .context()
        .addCookies([
          (await isolatedWorker.createSession(user.id)).cookie,
          { name: "NEXT_LOCALE", value: "zh-cn", url: isolatedWorker.origin },
        ]);
      const db = isolatedWorker.database.owner;
      for (const locale of ["zh-cn", "en-us"]) {
        await setLocale(page, locale, effects.headers);
        for (const width of widths) {
          await open(page, width);
          for (const [kind, label] of [
            ["teaching_assistant", /^(助教|Teaching assistant)$/],
            ["auditor", /^(旁听|Auditor)$/],
            ["regular", /^(普通|Regular)$/],
          ] as const) {
            const link = page
              .locator(
                `a[data-testid="subscription-course-link"][href="/catalog/sections/${sections[0].jwId}"]`,
              )
              .filter({ visible: true });
            const row = link.locator(
              'xpath=ancestor::*[self::tr or @data-slot="item"][1]',
            );
            await row
              .getByRole("button", {
                name: /^(教学班订阅身份|Section subscription role)$/,
              })
              .click();
            const dialog = page.getByRole("dialog", {
              name: /^(教学班订阅身份|Section subscription role)$/,
            });
            await dialog.getByRole("radio", { name: label }).click();
            await dialog.getByRole("button", { name: /^(保存|Save)$/ }).click();
            await expect(dialog).toBeHidden();
            expect(
              await db.userSectionSubscription.findUniqueOrThrow({
                where: {
                  userId_sectionId: {
                    userId: user.id,
                    sectionId: sections[0].id,
                  },
                },
              }),
            ).toMatchObject({ kind });
            await row
              .getByRole("button", {
                name: /^(教学班订阅身份|Section subscription role)$/,
              })
              .click();
            await expect(
              dialog.getByRole("radio", { name: label }),
            ).toHaveAttribute("data-state", "on");
            await page.keyboard.press("Escape");
          }
        }
      }
    },
  );
});

test("subscribed-sections.grouped-by-semester", {
  tag: "@Subscription/Web",
}, async ({ page, presentation, isolatedWorker, catalogSubscriptionRun }) => {
  const { user, sections, semesters } = presentation;
  await catalogSubscriptionRun(
    user,
    { calendarMessages: [], calendarTokenCreated: true },
    async () => {
      await page
        .context()
        .addCookies([
          (await isolatedWorker.createSession(user.id)).cookie,
          { name: "NEXT_LOCALE", value: "zh-cn", url: isolatedWorker.origin },
        ]);
      for (const width of widths) {
        await open(page, width);
        const groups = page
          .getByTestId("subscription-semester-groups")
          .locator(":scope > section");
        await expect(groups).toHaveCount(2);
        for (const semester of semesters) {
          const group = groups.filter({
            has: page.getByRole("heading", {
              name: `学期：${semester.nameCn}`,
              exact: true,
            }),
          });
          await expect(group).toBeVisible();
          const expected = sections.filter(
            ({ semesterId }) => semesterId === semester.id,
          );
          await expect(
            group
              .getByTestId("subscription-course-link")
              .filter({ visible: true }),
          ).toHaveCount(expected.length);
          await expect(group).toContainText(`${expected.length} 个教学班`);
          for (const section of expected)
            await expect(
              group
                .locator(
                  `a[data-testid="subscription-course-link"][href="/catalog/sections/${section.jwId}"]`,
                )
                .filter({ visible: true }),
            ).toBeVisible();
          for (const foreign of sections.filter(
            ({ semesterId }) => semesterId !== semester.id,
          ))
            await expect(
              group.locator(`a[href="/catalog/sections/${foreign.jwId}"]`),
            ).toHaveCount(0);
        }
      }
    },
  );
});

test("subscribed-sections.section-codes-promoted", {
  tag: "@Subscription/Web",
}, async ({ page, presentation, isolatedWorker, catalogSubscriptionRun }) => {
  const { user, sections, course, teacher } = presentation;
  await catalogSubscriptionRun(
    user,
    { calendarMessages: [], calendarTokenCreated: true },
    async () => {
      await page
        .context()
        .addCookies([
          (await isolatedWorker.createSession(user.id)).cookie,
          { name: "NEXT_LOCALE", value: "zh-cn", url: isolatedWorker.origin },
        ]);
      for (const width of widths) {
        await open(page, width);
        for (const section of sections) {
          const link = page
            .locator(
              `a[data-testid="subscription-course-link"][href="/catalog/sections/${section.jwId}"]`,
            )
            .filter({ visible: true });
          const item = link.locator(
            'xpath=ancestor::*[self::tr or @data-slot="item"][1]',
          );
          await expect(link).toContainText(course.nameCn);
          await expect(item).toContainText(teacher.nameCn);
          await expect(
            item.getByText(section.code, { exact: true }),
          ).toBeVisible();
          expect(
            await item
              .getByText(section.code, { exact: true })
              .evaluate((code) => getComputedStyle(code).fontFamily),
          ).toContain("monospace");
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
    },
  );
});

test("subscribed-sections.sidebar-summary-only", {
  tag: "@Subscription/Web",
}, async ({ page, presentation, isolatedWorker, catalogSubscriptionRun }) => {
  const { user, sections } = presentation;
  await catalogSubscriptionRun(
    user,
    { calendarMessages: [], calendarTokenCreated: true },
    async () => {
      await page
        .context()
        .addCookies([
          (await isolatedWorker.createSession(user.id)).cookie,
          { name: "NEXT_LOCALE", value: "zh-cn", url: isolatedWorker.origin },
        ]);
      for (const width of widths) {
        await open(page, width);
        if (width < 768)
          await page.getByRole("button", { name: /^(菜单|Menu)$/ }).click();
        const sidebar =
          width < 768
            ? page.getByRole("dialog", { name: "Sidebar", exact: true })
            : page.getByTestId("app-sidebar");
        await expect(sidebar).toBeVisible();
        const destination = sidebar.locator(
          'a[href="/workspace/subscriptions"]',
        );
        await expect(destination).toHaveCount(1);
        await expect(destination).toContainText("教学班订阅");
        await expect(destination).toHaveAttribute("aria-current", "page");
        await expect(
          sidebar.locator('a[href^="/catalog/sections/"]'),
        ).toHaveCount(0);
        for (const section of sections)
          await expect(sidebar).not.toContainText(section.code);
        if (width < 768) await page.keyboard.press("Escape");
      }
    },
  );
});
