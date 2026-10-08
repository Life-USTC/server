import { expect, type Page } from "@playwright/test";
import { formatSemesterName } from "../../../../../../src/lib/text/format-semester-name";
import type { TestPrismaClient } from "../../../../../shared/prisma";
import {
  type CalendarFixture,
  test as calendarTest,
} from "../../../../utils/calendar-presentation-fixture";

async function arrangeExams(db: TestPrismaClient, base: CalendarFixture) {
  const extra = await db.$transaction(async (db) => {
    const current = await db.semester.findUniqueOrThrow({
      where: { id: base.section.semesterId ?? 0 },
    });
    const past = await db.semester.create({
      data: {
        jwId: base.section.jwId + 40,
        code: `EXAM-${base.course.code}`,
        nameCn: "考试历史学期",
        startDate: new Date("2025-09-01Z"),
        endDate: new Date("2026-01-15Z"),
      },
    });
    const section = await db.section.create({
      data: {
        jwId: base.section.jwId + 41,
        code: `${base.course.code}.02`,
        courseId: base.course.id,
        semesterId: past.id,
      },
    });
    await db.userSectionSubscription.create({
      data: { userId: base.users[0].id, sectionId: section.id },
    });
    await db.exam.create({
      data: {
        jwId: base.section.jwId + 42,
        sectionId: section.id,
        examDate: new Date("2026-01-07Z"),
        startTime: 1300,
        endTime: 1400,
        examType: 1,
        examTakeCount: 1,
      },
    });
    return { current, past, section };
  });
  return {
    ...base,
    ...extra,
    currentSection: base.section,
  };
}
const test = calendarTest.extend<{
  examData: Awaited<ReturnType<typeof arrangeExams>>;
}>({
  examData: async ({ calendar, calendarDb }, use) => {
    await use(await calendarDb((db) => arrangeExams(db, calendar)));
  },
});
async function open(
  page: Page,
  data: Awaited<ReturnType<typeof arrangeExams>>,
  width = 390,
) {
  await page.setViewportSize({ width, height: 1000 });
  await page.context().clearCookies();
  await page
    .context()
    .addCookies([
      await data.createSignedSessionCookie(data.users[0].id),
      { name: "NEXT_LOCALE", value: "en-us", url: data.origin },
    ]);
  await page.goto(
    "/workspace/exams?snapshotAt=2026-04-29T09%3A30%3A00%2B08%3A00",
  );
  await expect(
    page
      .getByRole("group", { name: "Exams", exact: true })
      .getByRole("radio", { name: "All", exact: true }),
  ).toBeEnabled();
}
async function waitForMenuAutofocus(page: Page) {
  // Bits UI schedules opening autofocus across animation frames. Let it settle
  // so a late opening callback cannot reset focus after keyboard navigation.
  await page.getByRole("menu").evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}
const filters = (page: Page) =>
  page.getByRole("group", { name: "Exams", exact: true });
const visibleRows = (page: Page, width: number) =>
  width < 768
    ? page.getByTestId("workspace-exams-cards").locator('[data-slot="item"]')
    : page
        .getByRole("table")
        .getByRole("row")
        .filter({ has: page.locator('a[href^="/catalog/sections/"]') });

test("exam.attached-to-section", { tag: "@Exam/Web" }, async ({
  page,
  examData: data,
  calendarRun,
}) => {
  await calendarRun(
    async () => {
      for (const width of [1280, 390]) {
        await open(page, data, width);
        await filters(page)
          .getByRole("radio", { name: "All", exact: true })
          .click();
        const rows = visibleRows(page, width);
        await expect(rows).toHaveCount(2);
        for (const section of [data.currentSection, data.section]) {
          const row = rows.filter({
            has: page.locator(`a[href="/catalog/sections/${section.jwId}"]`),
          });
          await expect(row).toContainText(String(data.course.nameEn));
          await expect(row).toContainText(String(section.code));
          await row.getByRole("link").first().click();
          await expect(page).toHaveURL(
            new RegExp(`/catalog/sections/${section.jwId}`),
          );
          await page.goBack();
          await filters(page)
            .getByRole("radio", { name: "All", exact: true })
            .click();
        }
      }
    },
    { accountIndex: 0, calendarTokenCreated: true },
  );
});

test("exam.semester-required", { tag: "@Exam/Web" }, async ({
  page,
  examData: data,
  calendarRun,
}) => {
  await calendarRun(
    async () => {
      for (const width of [1280, 390]) {
        await open(page, data, width);
        await filters(page)
          .getByRole("radio", { name: "All", exact: true })
          .click();

        for (const [section, semester] of [
          [data.currentSection, data.current],
          [data.section, data.past],
        ] as const) {
          await expect(
            visibleRows(page, width).filter({
              has: page.locator(`a[href="/catalog/sections/${section.jwId}"]`),
            }),
          ).toContainText(formatSemesterName("en-us", semester.nameCn));
        }
      }
    },
    { accountIndex: 0, calendarTokenCreated: true },
  );
});

test("exam.read-only", { tag: "@Exam/Web" }, async ({
  page,
  examData: data,
  calendarRun,
  calendarDb,
}) => {
  await calendarRun(
    async () => {
      for (const width of [1280, 390]) {
        await open(page, data, width);
        await filters(page)
          .getByRole("radio", { name: "All", exact: true })
          .click();
        await expect(visibleRows(page, width)).toHaveCount(2);
        const main = page.locator("#main-content");
        await expect(
          main.getByRole("button", {
            name: /add|create|edit|delete|remove|complete/i,
          }),
        ).toHaveCount(0);
        await expect(
          main.locator('input,textarea,[contenteditable="true"]'),
        ).toHaveCount(0);
        await visibleRows(page, width)
          .first()
          .getByRole("link")
          .first()
          .click();
        const exams = page.locator("#exams");
        await expect(page.getByTestId("section-exams-list")).toBeVisible();
        await expect(
          exams.getByRole("button", {
            name: /add|create|edit|delete|remove|complete/i,
          }),
        ).toHaveCount(0);
      }
      await calendarDb(async (db) =>
        expect(
          await db.exam.count({
            where: {
              sectionId: { in: [data.currentSection.id, data.section.id] },
            },
          }),
        ).toBe(2),
      );
    },
    { accountIndex: 0, calendarTokenCreated: true },
  );
});

test("exam.mobile-toolbar-priority", { tag: "@Exam/Web" }, async ({
  page,
  examData: data,
  calendarRun,
}) => {
  await calendarRun(
    async () => {
      await open(page, data);
      const rows = visibleRows(page, 390);
      for (const [name, count, code] of [
        ["Upcoming", 1, data.currentSection.code],
        ["Ended", 1, data.section.code],
        ["All", 2, data.currentSection.code],
      ] as const) {
        const control = filters(page).getByRole("radio", { name, exact: true });
        await expect(control).toBeVisible();
        await control.click();
        await expect(control).toHaveAttribute("aria-checked", "true");
        await expect(rows).toHaveCount(count);
        await expect(rows.first()).toContainText(
          name === "All" ? String(data.section.code) : String(code),
        );
      }
    },
    { accountIndex: 0, calendarTokenCreated: true },
  );
});

test("exam.mobile-display-overflow", { tag: "@Exam/Web" }, async ({
  page,
  examData: data,
  calendarRun,
}) => {
  await calendarRun(
    async () => {
      await open(page, data);
      await filters(page)
        .getByRole("radio", { name: "All", exact: true })
        .click();

      const trigger = page.getByTestId("workspace-exams-view-menu");
      await expect(trigger).toBeVisible();
      await trigger.focus();
      await page.keyboard.press("Enter");
      const list = page.getByRole("menuitemradio", { name: /list/i });
      await expect(list).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(() => document.activeElement?.getAttribute("role")),
        )
        .toBe("menuitemradio");
      await waitForMenuAutofocus(page);
      await page.keyboard.press("End");
      await expect(list).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("table")).toBeVisible();
      await expect(page.getByTestId("workspace-exams-cards")).toBeHidden();
      await expect(trigger).toBeFocused();

      await page.keyboard.press("Enter");
      const cards = page.getByRole("menuitemradio", {
        name: "Card",
        exact: true,
      });
      await expect(cards).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(() => document.activeElement?.getAttribute("role")),
        )
        .toBe("menuitemradio");
      await waitForMenuAutofocus(page);
      await page.keyboard.press("Home");
      await expect(cards).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("workspace-exams-cards")).toBeVisible();
      await expect(page.getByRole("table")).toBeHidden();
      await expect(trigger).toBeFocused();

      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    },
    { accountIndex: 0, calendarTokenCreated: true },
  );
});

test("exam.mobile-toolbar-targets", { tag: "@Exam/Web" }, async ({
  page,
  examData: data,
  calendarRun,
}) => {
  await calendarRun(
    async () => {
      for (const width of [320, 390]) {
        await open(page, data, width);
        for (const control of [
          ...(await filters(page).getByRole("radio").all()),
          page.getByTestId("workspace-exams-view-menu"),
        ]) {
          await expect(control).toBeVisible();
          const box = await control.boundingBox();
          expect(box?.height).toBeGreaterThanOrEqual(44);
          expect(box?.width).toBeGreaterThanOrEqual(44);
        }
      }
    },
    { accountIndex: 0, calendarTokenCreated: true },
  );
});
