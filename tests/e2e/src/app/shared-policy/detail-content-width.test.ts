import { expect } from "@playwright/test";
import { test } from "../../../utils/catalog-browser-fixture";
import { gotoAndWaitForReady } from "../../../utils/page-ready";

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
          const observations: {
            width: number;
            reading: number;
            identityX: number;
            readingX: number;
          }[] = [];
          for (const width of [1023, 1024, 1144, 1280, 1440]) {
            await page.setViewportSize({ width, height: 900 });
            await gotoAndWaitForReady(page, route);
            const sidebar = page.locator('[data-slot="sidebar"][data-state]');
            if ((await sidebar.getAttribute("data-state")) === "collapsed") {
              await page.locator('[data-slot="sidebar-rail"]').click();
            }
            await expect(sidebar).toHaveAttribute("data-state", "expanded");
            await page.evaluate(async () => {
              await Promise.all(
                document
                  .getAnimations()
                  .filter(
                    (animation) =>
                      animation.effect?.getTiming().iterations !== Infinity,
                  )
                  .map((animation) => animation.finished.catch(() => {})),
              );
            });
            const reading = page.locator("[data-detail-reading-stream]");
            const identity = page.locator("[data-detail-identity]");
            await expect(reading).toBeVisible();
            await expect(identity).toBeVisible();
            if (kind === "section") {
              const table = page.getByTestId("section-calendar-table");
              await expect(table).toBeVisible();
              const lastCell = table.locator("tbody tr td:last-child").first();
              await expect(lastCell).toContainText("教学楼东侧研讨室");
              await info.attach(`section-schedule-${width}`, {
                body: await page.screenshot({ fullPage: true }),
                contentType: "image/png",
              });
              const tableWidth = await table.evaluate(
                (node) => node.getBoundingClientRect().width,
              );
              const available = await reading.evaluate(
                (node) => node.getBoundingClientRect().width,
              );
              expect(tableWidth).toBeLessThanOrEqual(available + 1);
            }
            const metrics = await page.evaluate(() => {
              const reading = document
                .querySelector("[data-detail-reading-stream]")
                ?.getBoundingClientRect();
              const identity = document
                .querySelector("[data-detail-identity]")
                ?.getBoundingClientRect();
              if (!reading || !identity)
                throw new Error("Missing detail layout");
              return {
                reading: reading.width,
                readingX: reading.x,
                identityX: identity.x,
              };
            });
            observations.push({ width, ...metrics });
            if ([1024, 1144, 1440].includes(width))
              await info.attach(`${kind}-${width}`, {
                body: await page.screenshot({ fullPage: true }),
                contentType: "image/png",
              });
          }
          expect(observations[1].reading).toBeGreaterThanOrEqual(
            observations[0].reading - 16,
          );
          for (const row of observations)
            expect(row.reading).toBeGreaterThanOrEqual(540);
          expect(observations.at(-1)?.identityX).toBeGreaterThan(
            observations.at(-1)?.readingX ?? 0,
          );
          await page.setViewportSize({ width: 1144, height: 900 });
          await gotoAndWaitForReady(page, route);
          await page.locator('[data-slot="sidebar-rail"]').click();
          await expect
            .poll(async () => {
              const reading = await page
                .locator("[data-detail-reading-stream]")
                .boundingBox();
              const identity = await page
                .locator("[data-detail-identity]")
                .boundingBox();
              return Boolean(
                reading && identity && identity.x > reading.x + reading.width,
              );
            })
            .toBe(true);
          const collapsedReading = await page
            .locator("[data-detail-reading-stream]")
            .boundingBox();
          expect(collapsedReading?.width).toBeGreaterThanOrEqual(540);
          await info.attach(`${kind}-1144-collapsed`, {
            body: await page.screenshot({ fullPage: true }),
            contentType: "image/png",
          });
        },
        { anonymousCourseCount: 1 },
      );
    },
  );
}
