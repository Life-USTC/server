import { expect } from "@playwright/test";
import { test } from "../../../utils/catalog-browser-fixture";
import { gotoAndWaitForReady } from "../../../utils/page-ready";

test.use({ deviceScaleFactor: 2 });

for (const kind of ["course", "teacher", "section"] as const) {
  test(
    `ui.detail-content-width ${kind}`,
    { tag: `@${kind[0].toUpperCase()}${kind.slice(1)}/Web` },
    async ({ page, isolatedWorker, catalogFlow }, info) => {
      const db = isolatedWorker.database.owner;
      await catalogFlow.run(
        async () => {
          const course = await db.course.create({
            data: {
              jwId: 180010001,
              code: "WIDTH",
              nameCn: "详情阅读宽度",
              nameEn: "Detail reading width",
              educationLevel: {
                create: { nameCn: "本科", nameEn: "Undergraduate" },
              },
            },
          });
          const teacher = await db.teacher.create({
            data: {
              jwId: 180010001,
              nameCn: "测试教师",
              nameEn: "Example teacher",
              email: "teacher@example.test",
            },
          });
          const section = await db.section.create({
            data: {
              jwId: 180010001,
              code: "WIDTH.01",
              courseId: course.id,
              teachers: { connect: { id: teacher.id } },
            },
          });
          const route =
            kind === "course"
              ? `/catalog/courses/${course.jwId}`
              : kind === "teacher"
                ? `/catalog/teachers/${teacher.id}`
                : `/catalog/sections/${section.jwId}`;
          if (kind === "section") {
            const group = await db.scheduleGroup.create({
              data: {
                jwId: 180010001,
                sectionId: section.id,
                no: 1,
                limitCount: 30,
                stdCount: 20,
                actualPeriods: 2,
                isDefault: true,
              },
            });
            await db.schedule.create({
              data: {
                sectionId: section.id,
                scheduleGroupId: group.id,
                date: new Date("2026-11-06T00:00:00Z"),
                weekday: 5,
                startTime: 945,
                endTime: 1210,
                periods: 3,
                weekIndex: 10,
                startUnit: 3,
                endUnit: 5,
                customPlace: "教学楼东侧研讨室",
              },
            });
          }
          for (const width of [390, 1023, 1024, 1144, 1280, 1440, 1920]) {
            await page.setViewportSize({ width, height: 1080 });
            await gotoAndWaitForReady(
              page,
              `${route}/${kind === "section" ? "calendar" : "introduction"}`,
            );
            const stream = page.locator("[data-detail-reading-stream]");
            await expect(stream).toBeVisible();
            await expect(page.locator("[data-detail-identity]")).toHaveCount(0);
            const available = await page
              .locator("[data-detail-scroll-container]")
              .evaluate((node) => node.clientWidth);
            const bounds = await stream.boundingBox();
            expect(bounds?.width).toBeGreaterThanOrEqual(
              Math.min(1152, available - 65),
            );
            const edges = await stream.evaluate((body) => {
              const rect = body.getBoundingClientRect();
              const frames = [
                document.querySelector(
                  "[data-testid=shell-detail-navigation] .page-frame",
                ),
                document.querySelector("#main-content h1")?.closest("header"),
              ];
              return frames.map((frame) => {
                if (!frame) return null;
                const { left, right } = frame.getBoundingClientRect();
                return [
                  Math.round(left - rect.left),
                  Math.round(right - rect.right),
                ];
              });
            });
            expect(edges).toEqual([
              [0, 0],
              [0, 0],
            ]);
            if (kind === "section") {
              const table = page.getByTestId("section-calendar-table");
              await expect(
                table.locator("tbody tr td:last-child").first(),
              ).toContainText("教学楼东侧研讨室");
              await info.attach(`section-schedule-${width}`, {
                body: await page.screenshot(),
                contentType: "image/png",
              });
            }
          }
        },
        { anonymousCourseCount: 1 },
      );
    },
  );
}
