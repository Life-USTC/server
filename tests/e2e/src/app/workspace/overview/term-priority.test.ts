import { expect, test } from "@playwright/test";
import { createCalendarContractFixture } from "../../../../utils/calendar-contract";
import { PLAYWRIGHT_BASE_URL } from "../../../../utils/e2e-db/core";
import { withE2ePrisma } from "../../../../utils/e2e-db/prisma";
import { createSignedSessionCookie } from "../../../../utils/workspace-task-filters";

test("overview.current-semester-priority", async ({ page }) => {
  test.setTimeout(180_000);
  const fixture = await createCalendarContractFixture();
  const extra = await withE2ePrisma(async (db) => {
    const semester = await db.semester.create({
      data: {
        jwId: fixture.section.jwId + 20,
        nameCn: "往期验证学期",
        code: `PAST-${fixture.course.code}`,
        startDate: new Date("2025-09-01T00:00:00Z"),
        endDate: new Date("2026-01-15T00:00:00Z"),
      },
    });
    await db.section.update({
      where: { id: fixture.section.id },
      data: { semesterId: semester.id },
    });
    const currentSection = await db.section.create({
      data: {
        jwId: fixture.section.jwId + 21,
        code: `${fixture.course.code}.02`,
        courseId: fixture.course.id,
        semesterId: fixture.section.semesterId,
      },
    });
    return { semester, currentSection };
  });
  try {
    for (const mixed of [false, true]) {
      if (mixed)
        await withE2ePrisma((db) =>
          db.userSectionSubscription.create({
            data: {
              userId: fixture.users[0].id,
              sectionId: extra.currentSection.id,
            },
          }),
        );
      for (const locale of ["en-us", "zh-cn"]) {
        await page.context().clearCookies();
        await page
          .context()
          .addCookies([
            await createSignedSessionCookie(fixture.users[0].id),
            { name: "NEXT_LOCALE", value: locale, url: PLAYWRIGHT_BASE_URL },
          ]);
        for (const width of [1280, 390]) {
          await page.setViewportSize({ width, height: 1000 });
          for (const [time, title, destination] of [
            [
              "2026-04-29T09:30:00+08:00",
              locale === "en-us"
                ? (fixture.course.nameEn ?? fixture.course.nameCn)
                : fixture.course.nameCn,
              `/catalog/sections/${fixture.section.jwId}`,
            ],
            [
              "2026-04-29T11:30:00+08:00",
              fixture.homework.title,
              `/catalog/sections/${fixture.section.jwId}?homeworkId=${fixture.homework.id}#homework`,
            ],
            [
              "2026-04-30T16:30:00+08:00",
              fixture.young.name,
              `/catalog/young-events/${fixture.young.youngId}`,
            ],
          ] as const) {
            await page.goto(
              `/workspace/overview?snapshotAt=${encodeURIComponent(time)}&overviewWeek=2026-04-27`,
            );
            if (!mixed && time.includes("09:30"))
              await page.screenshot({
                path: `/tmp/life-spec-business-overview-current-term-${locale}-${width}.png`,
                fullPage: true,
              });
            const focus = page.getByTestId("workspace-overview-focus");
            await expect(focus).toContainText(title);
            await expect(focus.getByRole("link")).toHaveAttribute(
              "href",
              destination,
            );
            if (!mixed) {
              const context = page.getByTestId(
                "workspace-overview-term-context",
              );
              await expect(context).toBeVisible();
              await expect(context).not.toContainText(
                /restore your workspace|恢复工作区/,
              );
              const contextBox = await context.boundingBox();
              const focusBox = await focus.boundingBox();
              if (!contextBox || !focusBox)
                throw new Error("Visible overview sections must have bounds");
              expect(contextBox.y).toBeGreaterThan(focusBox.y);
              for (const tab of [
                "subscriptions",
                "calendar",
                "homeworks",
                "exams",
              ] as const) {
                await expect(
                  context.locator(`a[href^="/workspace/${tab}"]`).first(),
                ).toBeVisible();
              }
            }
          }
          await page.goto(
            `/workspace/overview?snapshotAt=2026-04-29T14%3A30%3A00%2B08%3A00&overviewWeek=2026-04-27`,
          );
          await expect(
            page.getByTestId("workspace-overview-summaries"),
          ).toContainText(fixture.todo.title);
        }
      }
    }
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto(fixture.academicUrl("week"));
    const selectedCalendar = page.getByTestId("workspace-calendar-grid");
    await expect(selectedCalendar).toBeVisible();
    await expect(
      selectedCalendar.locator(
        `a[href="/catalog/sections/${fixture.section.jwId}"]`,
      ),
    ).toHaveCount(0);
    await expect(
      selectedCalendar.getByRole("link", {
        name: new RegExp(fixture.homework.title),
      }),
    ).toHaveCount(0);
  } finally {
    await withE2ePrisma(async (db) => {
      await db.section.delete({ where: { id: extra.currentSection.id } });
    });
    await fixture.cleanup();
    await withE2ePrisma((db) =>
      db.semester.delete({ where: { id: extra.semester.id } }),
    );
  }
});
