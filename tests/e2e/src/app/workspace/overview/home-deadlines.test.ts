import { expect } from "@playwright/test";
import { test } from "../../../../utils/calendar-presentation-fixture";

for (const locale of ["en-us", "zh-cn"]) {
  for (const width of [1280, 390]) {
    test(
      `overview.home-deadline-state ${locale} ${width}`,
      { tag: "@Overview/Web" },
      async ({ page, calendar, calendarDb, calendarRun }, testInfo) => {
        await calendarDb(async (db) => {
          await db.youngEvent.update({
            where: { youngId: calendar.young.youngId },
            data: { name: "Campus activity" },
          });
          await db.course.update({
            where: { id: calendar.course.id },
            data: { nameCn: "校园课程", nameEn: "Campus course" },
          });
          await db.section.update({
            where: { id: calendar.section.id },
            data: { code: "HOME1436.01" },
          });
          await db.todo.update({
            where: { id: calendar.todo.id },
            data: {
              title: "Earlier campus task",
              dueAt: new Date("2026-04-26T09:00:00+08:00"),
            },
          });
          await db.homework.update({
            where: { id: calendar.homework.id },
            data: {
              title: "Today campus homework",
              submissionDueAt: new Date("2026-04-29T12:00:00+08:00"),
            },
          });
        });
        await calendarRun(
          async () => {
            await page.setViewportSize({ width, height: 1000 });
            await page
              .context()
              .addCookies([
                await calendar.createSignedSessionCookie(calendar.users[0].id),
                { name: "NEXT_LOCALE", value: locale, url: calendar.origin },
              ]);
            await page.goto(
              `/?snapshotAt=${encodeURIComponent("2026-04-29T09:30:00+08:00")}`,
            );
            const urgency = page.getByTestId("workspace-overview-urgency");
            const overdue = urgency.locator(
              `[data-overview-item="todo-${calendar.todo.id}"]`,
            );
            const upcoming = urgency.locator(
              `[data-overview-item="homework-${calendar.homework.id}"]`,
            );
            const label = locale === "en-us" ? "Overdue" : "已逾期";
            await expect(overdue).toContainText(label);
            await expect(upcoming).not.toContainText(label);
            await page.getByTestId("home-personal-overview").screenshot({
              path: testInfo.outputPath(`deadlines-${locale}-${width}.png`),
            });
            await overdue.click();
            await expect(page).toHaveURL(/\/workspace\/todos/);
            await expect(
              page.locator(':text-is("Earlier campus task"):visible').first(),
            ).toBeVisible();
            await page.goto(
              `/?snapshotAt=${encodeURIComponent("2026-04-29T12:30:00+08:00")}`,
            );
            await expect(
              page.getByTestId("workspace-overview-focus"),
            ).toContainText(label);
          },
          { accountIndex: 0, calendarTokenCreated: false },
        );
      },
    );
  }
}
