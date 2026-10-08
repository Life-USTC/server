import { expect, type Page } from "@playwright/test";
import { DEV_SEED } from "../../../utils/dev-seed";
import type { IsolatedWorker } from "../../../utils/isolated-worker";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import {
  createSemesterTerms,
  prepareSemesterObservation,
  type SemesterProtocolRun,
  test,
} from "./semester-presentation-fixture";

async function assertTaskSemesterLabels(
  page: Page,
  kind: "homeworks" | "exams",
  isolatedWorker: IsolatedWorker,
  calendarProtocolRun: SemesterProtocolRun,
) {
  await calendarProtocolRun(async (io) => {
    const marker = `task-semester-${crypto.randomUUID().slice(0, 8)}`;
    const base = 1_700_000_000 + Math.floor(Math.random() * 100_000_000);
    const fixture = await isolatedWorker.database.owner.$transaction(
      async (db) => {
        await createSemesterTerms(db);
        const user = await db.user.create({
          data: {
            id: crypto.randomUUID(),
            name: marker,
            username: marker,
            email: `${marker}@example.test`,
          },
        });
        const course = await db.course.create({
          data: { jwId: base, code: marker, nameCn: marker, nameEn: marker },
        });
        const semesters = await db.semester.findMany({
          where: {
            jwId: {
              in: [DEV_SEED.semesterJwId, DEV_SEED.previousSemesterJwId],
            },
          },
        });
        const rows = [];
        for (const [index, jwId] of [
          DEV_SEED.semesterJwId,
          DEV_SEED.previousSemesterJwId,
          null,
        ].entries()) {
          const semester = semesters.find((s) => s.jwId === jwId);
          const section = await db.section.create({
            data: {
              jwId: base + index + 1,
              code: `${marker}.0${index + 1}`,
              courseId: course.id,
              semesterId: semester?.id ?? null,
            },
          });
          await db.userSectionSubscription.create({
            data: { userId: user.id, sectionId: section.id },
          });
          const title = `${marker}-${index}`;
          if (kind === "homeworks")
            await db.homework.create({
              data: {
                title,
                createdById: user.id,
                sectionId: section.id,
                publishedAt: new Date(),
              },
            });
          else
            await db.exam.create({
              data: {
                jwId: base + index + 4,
                sectionId: section.id,
                examMode: "Written exam",
              },
            });
          rows.push({ section, title, semesterName: semester?.nameCn ?? null });
        }
        return { user, course, rows };
      },
    );
    const observation = await prepareSemesterObservation(
      page,
      isolatedWorker,
      io,
      fixture.user.id,
      [],
    );
    for (const locale of ["en-us", "zh-cn"]) {
      expect(
        (
          await page.request.post("/api/account/preferences", {
            data: { locale },
          })
        ).status(),
      ).toBe(200);
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await gotoAndWaitForReady(page, `/workspace/${kind}`);
        await page
          .getByRole("radio", {
            name: locale === "en-us" ? "All" : "全部",
            exact: true,
          })
          .click();

        for (const item of fixture.rows) {
          const row =
            width >= 768
              ? page.getByRole("row").filter(
                  kind === "homeworks"
                    ? { hasText: item.title }
                    : {
                        has: page.locator(
                          `a[href="/catalog/sections/${item.section.jwId}"]`,
                        ),
                      },
                )
              : page.locator('[data-slot="item"]').filter(
                  kind === "homeworks"
                    ? { hasText: item.title }
                    : {
                        has: page.locator(
                          `a[href="/catalog/sections/${item.section.jwId}"]`,
                        ),
                      },
                );
          await expect(row.filter({ visible: true })).toHaveCount(1);
          await expect(row.filter({ visible: true })).toContainText(
            item.semesterName
              ? locale === "en-us"
                ? item.semesterName === DEV_SEED.semesterNameCn
                  ? "Spring 2026"
                  : "Fall 2025"
                : item.semesterName
              : locale === "en-us"
                ? "Unknown"
                : "未知",
          );
        }
      }
    }
    return observation.checks({
      feedTokenCreated: kind === "exams",
      requests: [["POST", "/api/account/preferences", [200, 200]]],
    });
  });
}

test("cases.semester.cross-semester-browsing-3", {
  tag: "@Homework/Web",
}, async ({ page, isolatedWorker, calendarProtocolRun }) => {
  await assertTaskSemesterLabels(
    page,
    "homeworks",
    isolatedWorker,
    calendarProtocolRun,
  );
});

test("cases.semester.cross-semester-browsing-4", { tag: "@Todo/Web" }, async ({
  page,
  isolatedWorker,
  calendarProtocolRun,
}) => {
  await assertTaskSemesterLabels(
    page,
    "exams",
    isolatedWorker,
    calendarProtocolRun,
  );
});
