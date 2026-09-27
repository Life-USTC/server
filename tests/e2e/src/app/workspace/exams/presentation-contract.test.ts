import { expect, type Page, test } from "@playwright/test";
import { formatSemesterName } from "../../../../../../src/lib/text/format-semester-name";
import { createCalendarContractFixture } from "../../../../utils/calendar-contract";
import { PLAYWRIGHT_BASE_URL } from "../../../../utils/e2e-db/core";
import { withE2ePrisma } from "../../../../utils/e2e-db/prisma";
import { createSignedSessionCookie } from "../../../../utils/workspace-task-filters";

async function fixture() {
  const base = await createCalendarContractFixture();
  const extra = await withE2ePrisma(async (db) => {
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
    cleanup: async () => {
      await withE2ePrisma(async (db) => {
        await db.exam.deleteMany({ where: { sectionId: extra.section.id } });
        await db.userSectionSubscription.deleteMany({
          where: { sectionId: extra.section.id },
        });
        await db.section.delete({ where: { id: extra.section.id } });
        await db.semester.delete({ where: { id: extra.past.id } });
      });
      await base.cleanup();
    },
  };
}
async function open(
  page: Page,
  data: Awaited<ReturnType<typeof fixture>>,
  width = 390,
) {
  await page.setViewportSize({ width, height: 1000 });
  await page.context().clearCookies();
  await page
    .context()
    .addCookies([
      await createSignedSessionCookie(data.users[0].id),
      { name: "NEXT_LOCALE", value: "en-us", url: PLAYWRIGHT_BASE_URL },
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
const filters = (page: Page) =>
  page.getByRole("group", { name: "Exams", exact: true });
const visibleRows = (page: Page, width: number) =>
  width < 768
    ? page.getByTestId("workspace-exams-cards").locator('[data-slot="item"]')
    : page
        .getByRole("table")
        .getByRole("row")
        .filter({ has: page.locator('a[href^="/catalog/sections/"]') });

test("exam.attached-to-section", async ({ page }) => {
  const data = await fixture();
  try {
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
  } finally {
    await data.cleanup();
  }
});

test("exam.semester-required", async ({ page }) => {
  const data = await fixture();
  try {
    for (const width of [1280, 390]) {
      await open(page, data, width);
      await filters(page)
        .getByRole("radio", { name: "All", exact: true })
        .click();
      await page.screenshot({
        path: `/tmp/life-spec-business-exam-semester-${width}.png`,
        fullPage: true,
      });
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
  } finally {
    await data.cleanup();
  }
});

test("exam.read-only", async ({ page }) => {
  const data = await fixture();
  try {
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
      await visibleRows(page, width).first().getByRole("link").first().click();
      const exams = page.locator("#exams");
      await expect(page.getByTestId("section-exams-list")).toBeVisible();
      await expect(
        exams.getByRole("button", {
          name: /add|create|edit|delete|remove|complete/i,
        }),
      ).toHaveCount(0);
    }
    await withE2ePrisma(async (db) =>
      expect(
        await db.exam.count({
          where: {
            sectionId: { in: [data.currentSection.id, data.section.id] },
          },
        }),
      ).toBe(2),
    );
  } finally {
    await data.cleanup();
  }
});

test("exam.mobile-toolbar-priority", async ({ page }) => {
  const data = await fixture();
  try {
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
  } finally {
    await data.cleanup();
  }
});

test("exam.mobile-display-overflow", async ({ page }) => {
  const data = await fixture();
  try {
    await open(page, data);
    await filters(page)
      .getByRole("radio", { name: "All", exact: true })
      .click();
    await page.screenshot({
      path: "/tmp/life-spec-business-exam-overflow.png",
      fullPage: true,
    });
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
    await page.keyboard.press("End");
    await expect(list).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByTestId("workspace-exams-cards")).toBeHidden();
    await expect(trigger).toBeFocused();
    await page.screenshot({
      path: "/tmp/life-spec-business-exam-list-after.png",
      fullPage: true,
    });
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
    await page.keyboard.press("Home");
    await expect(cards).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("workspace-exams-cards")).toBeVisible();
    await expect(page.getByRole("table")).toBeHidden();
    await expect(trigger).toBeFocused();
    await page.screenshot({
      path: "/tmp/life-spec-business-exam-overflow-after.png",
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  } finally {
    await data.cleanup();
  }
});

test("exam.mobile-toolbar-targets", async ({ page }) => {
  const data = await fixture();
  try {
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
  } finally {
    await data.cleanup();
  }
});
