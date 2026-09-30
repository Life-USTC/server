import { expect } from "@playwright/test";
import { openCatalogFilterSheet } from "../../../utils/catalog-filter-sheet";
import { DEV_SEED } from "../../../utils/dev-seed";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import {
  createSemesterTerms,
  prepareSemesterObservation,
  test,
} from "./semester-presentation-fixture";

test("semester.semester-visible-in-filters", async ({
  page,
  isolatedWorker,
  calendarProtocolRun,
}, testInfo) => {
  test.setTimeout(120_000);
  await calendarProtocolRun(async (io) => {
    const marker = `sem-label-${crypto.randomUUID().slice(0, 8)}`;
    const base = 1_600_000_000 + Math.floor(Math.random() * 100_000_000);
    const f = await isolatedWorker.database.owner.$transaction(async (db) => {
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
        data: { jwId: base, code: marker, nameCn: marker },
      });
      const teacher = await db.teacher.create({
        data: { jwId: base, nameCn: marker },
      });
      const unusualTerm = await db.semester.create({
        data: {
          jwId: base,
          code: marker,
          nameCn: "专项短学期 α",
          startDate: new Date("2024-07-01"),
          endDate: new Date("2024-07-15"),
        },
      });
      const terms = [];
      for (const [index, jwId] of [
        DEV_SEED.semesterJwId,
        DEV_SEED.previousSemesterJwId,
        unusualTerm.jwId,
      ].entries()) {
        const term = await db.semester.findUniqueOrThrow({ where: { jwId } });
        const section = await db.section.create({
          data: {
            jwId: base + index + 1,
            code: `${marker}.${index}`,
            courseId: course.id,
            semesterId: term.id,
            teachers: { connect: { id: teacher.id } },
          },
        });
        await db.userSectionSubscription.create({
          data: { userId: user.id, sectionId: section.id },
        });
        await db.exam.create({
          data: {
            jwId: base + index + 3,
            sectionId: section.id,
            examMode: "Written",
          },
        });
        await db.homework.create({
          data: {
            sectionId: section.id,
            createdById: user.id,
            title: `${marker} task ${index}`,
          },
        });
        terms.push({ term, section });
      }
      return { user, course, teacher, terms, unusualTerm };
    });
    const observation = await prepareSemesterObservation(
      page,
      isolatedWorker,
      io,
      f.user.id,
      [],
    );
    for (const locale of ["en-us", "zh-cn"] as const) {
      expect(
        (
          await page.request.post("/api/account/preferences", {
            data: { locale },
          })
        ).status(),
      ).toBe(200);
      const labels =
        locale === "en-us"
          ? ["Spring 2026", "Fall 2025", "专项短学期 α"]
          : f.terms.map(({ term }) => term.nameCn);
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 });
        for (const route of [
          `/catalog/courses/${f.course.jwId}`,
          `/catalog/teachers/${f.teacher.id}`,
          `/catalog/sections?courseCode=${marker}`,
          "/workspace/subscriptions",
        ]) {
          await gotoAndWaitForReady(page, route);
          if (route.startsWith("/catalog/courses/") && locale === "en-us")
            await page.screenshot({
              path: testInfo.outputPath(`semester-labels-${width}.png`),
              fullPage: true,
            });
          for (const label of labels)
            await expect(page.locator("#main-content")).toContainText(label);
        }
        await gotoAndWaitForReady(
          page,
          `/catalog/sections?courseCode=${marker}`,
        );
        const dialog = await openCatalogFilterSheet(page);
        for (const [index, { term }] of f.terms.entries())
          await expect(
            dialog.locator(
              `select[name="semesterId"] option[value="${term.id}"]`,
            ),
          ).toHaveText(labels[index]);
        await page.keyboard.press("Escape");
        for (const { term, section } of f.terms) {
          await gotoAndWaitForReady(
            page,
            `/catalog/sections?courseCode=${marker}&semesterId=${term.id}`,
          );
          await expect(
            page
              .locator(
                `#main-content a[href="/catalog/sections/${section.jwId}"]`,
              )
              .filter({ visible: true }),
          ).toHaveCount(1);
          for (const other of f.terms.filter(
            (item) => item.term.id !== term.id,
          ))
            await expect(
              page.locator(
                `#main-content a[href="/catalog/sections/${other.section.jwId}"]`,
              ),
            ).toHaveCount(0);
        }
        for (const kind of ["exams", "homeworks"]) {
          await gotoAndWaitForReady(page, `/workspace/${kind}`);
          await page
            .getByRole("radio", {
              name: locale === "en-us" ? "All" : "全部",
              exact: true,
            })
            .click();
          for (const label of labels)
            await expect(page.locator("#main-content")).toContainText(label);
        }
        await gotoAndWaitForReady(page, "/workspace/subscriptions");
        for (const action of locale === "en-us"
          ? ["Add Subscription", "Bulk Add Subscriptions"]
          : ["添加订阅", "批量添加订阅"]) {
          await page.getByRole("button", { name: action, exact: true }).click();
          const semesterSelect = page.getByRole("dialog").locator("select");
          for (const [index, { term }] of f.terms.entries()) {
            await expect(
              semesterSelect.locator(`option[value="${term.id}"]`),
            ).toHaveText(labels[index]);
            await semesterSelect.selectOption(String(term.id));
            await expect(semesterSelect.locator("option:checked")).toHaveText(
              labels[index],
            );
          }
          await page.keyboard.press("Escape");
        }
        // Semester navigation exists on desktop; mobile calendar navigation is date based.
        if (width === 1280)
          for (const [index, { term }] of f.terms.entries()) {
            await gotoAndWaitForReady(
              page,
              `/workspace/calendar?calendarView=semester&calendarSemester=${term.id}`,
            );
            await expect(page.locator("#main-content")).toContainText(
              labels[index],
            );
          }
      }
    }
    return observation.checks({
      feedTokenCreated: true,
      requests: [["POST", "/api/account/preferences", [200, 200]]],
    });
  });
});
