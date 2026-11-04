import { expect } from "@playwright/test";
import { test } from "../../../utils/catalog-browser-fixture";
import { gotoAndWaitForReady } from "../../../utils/page-ready";

for (const kind of ["course", "teacher"] as const) {
  test(
    `${kind}.chronological-history`,
    {
      tag: kind === "course" ? "@Course/Web" : "@Teacher/Web",
    },
    async ({ page, isolatedWorker, catalogFlow }, testInfo) => {
      const db = isolatedWorker.database.owner;
      await catalogFlow.run(
        async () => {
          const course = await db.course.create({
            data: {
              jwId: 1900100301,
              code: "HISTORY-TIME",
              nameCn: "历史学期顺序",
              nameEn: "Historical semester order",
            },
          });
          const teacher = await db.teacher.create({
            data: {
              jwId: 1900100301,
              nameCn: "历史学期教师",
              nameEn: "History teacher",
            },
          });
          // These real upstream IDs are intentionally not in chronological order.
          const terms = [
            {
              jwId: 47,
              nameCn: "2009年秋季学期",
              code: "20091",
              startDate: new Date("2009-09-01T00:00:00Z"),
            },
            {
              jwId: 48,
              nameCn: "2006年秋季学期",
              code: "20061",
              startDate: new Date("2006-09-01T00:00:00Z"),
            },
            {
              jwId: 31,
              nameCn: "2005年秋季学期",
              code: "20051",
              startDate: new Date("2005-09-01T00:00:00Z"),
            },
          ];
          const sections = [];
          for (const [index, term] of terms.entries()) {
            const semester = await db.semester.create({ data: term });
            sections.push(
              await db.section.create({
                data: {
                  jwId: 1900200301 + index,
                  code: `HISTORY-TIME.0${index + 1}`,
                  courseId: course.id,
                  semesterId: semester.id,
                  teachers: { connect: { id: teacher.id } },
                },
              }),
            );
          }
          const route =
            kind === "course"
              ? `/catalog/courses/${course.jwId}`
              : `/catalog/teachers/${teacher.id}`;
          const observed: string[][] = [];
          for (const viewport of [
            { width: 1280, height: 900 },
            { width: 390, height: 844 },
          ]) {
            await page.setViewportSize(viewport);
            await gotoAndWaitForReady(page, `${route}#sections`);
            const rows = page.locator(
              '#sections table:visible tbody tr td:first-child a, #sections a[data-slot="item"]:visible',
            );
            await expect(rows).toHaveCount(3);
            observed.push(
              await rows.evaluateAll((links) =>
                links.map((link) => link.getAttribute("href") ?? ""),
              ),
            );
            await testInfo.attach(`${kind}-history-${viewport.width}`, {
              body: await page.screenshot({ fullPage: true }),
              contentType: "image/png",
            });
          }
          for (const ids of observed)
            expect(ids).toEqual(
              sections.map((section) => `/catalog/sections/${section.jwId}`),
            );
          expect(
            await db.section.findMany({ orderBy: { jwId: "asc" } }),
          ).toEqual(sections);
        },
        { anonymousCourseCount: 1 },
      );
    },
  );
}
