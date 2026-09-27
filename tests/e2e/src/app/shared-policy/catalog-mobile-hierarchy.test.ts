import { expect, type Locator, test } from "@playwright/test";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { gotoAndWaitForReady } from "../../../utils/page-ready";

async function createFixture() {
  const base = 1_700_000_000 + Math.floor(Math.random() * 100_000_000);
  return withE2ePrisma((db) =>
    db.$transaction(async (tx) => {
      const suffix = crypto.randomUUID().slice(0, 8);
      const education = await tx.educationLevel.create({
        data: { nameCn: `层次${suffix}`, nameEn: `Level ${suffix}` },
      });
      const category = await tx.courseCategory.create({
        data: { nameCn: `类别${suffix}`, nameEn: `Category ${suffix}` },
      });
      const classType = await tx.classType.create({
        data: { nameCn: `类型${suffix}`, nameEn: `Class type ${suffix}` },
      });
      const department = await tx.department.create({
        data: {
          code: suffix,
          nameCn: `学院${suffix}`,
          nameEn: `Department ${suffix}`,
        },
      });
      const title = await tx.teacherTitle.create({
        data: {
          jwId: base + 3,
          code: suffix,
          nameCn: `职称${suffix}`,
          nameEn: `Title ${suffix}`,
        },
      });
      const semester = await tx.semester.create({
        data: { jwId: base + 4, code: suffix, nameCn: "2026-2027学年第一学期" },
      });
      const campus = await tx.campus.create({
        data: {
          jwId: base + 5,
          nameCn: `校区${suffix}`,
          nameEn: `Campus ${suffix}`,
        },
      });
      const user = await tx.user.create({
        data: { name: "Hierarchy author", email: `${suffix}@example.test` },
      });
      const course = await tx.course.create({
        data: {
          jwId: base,
          code: `HIER-${suffix}`,
          nameCn: "移动阅读层次测试课程",
          nameEn: "Mobile reading hierarchy course",
          educationLevelId: education.id,
          categoryId: category.id,
          classTypeId: classType.id,
        },
      });
      const teacher = await tx.teacher.create({
        data: {
          jwId: base + 1,
          code: `HIER-T-${suffix}`,
          nameCn: "移动阅读层次测试教师",
          nameEn: "Mobile reading hierarchy teacher",
          departmentId: department.id,
          teacherTitleId: title.id,
          email: `teacher-${suffix}@example.test`,
        },
      });
      const section = await tx.section.create({
        data: {
          jwId: base + 2,
          code: `HIER-S-${suffix}`,
          courseId: course.id,
          teachers: { connect: { id: teacher.id } },
          semesterId: semester.id,
          campusId: campus.id,
          credits: 4,
          remark: `Secondary section facts ${suffix}`,
        },
      });
      for (const target of [
        { courseId: course.id },
        { teacherId: teacher.id },
        { sectionId: section.id },
      ]) {
        await tx.description.create({
          data: {
            ...target,
            content: "Readable introduction for the catalog hierarchy.",
            lastEditedById: user.id,
          },
        });
      }
      return {
        education,
        category,
        classType,
        department,
        title,
        semester,
        campus,
        user,
        course,
        teacher,
        section,
      };
    }),
  );
}

function required(value: string | null) {
  if (value === null) throw new Error("Fixture field must be populated");
  return value;
}

async function box(locator: Locator) {
  const result = await locator.boundingBox();
  if (!result) throw new Error("Required catalog region is not visible");
  return result;
}

test("ui.layout-principles-3", async ({ page }, testInfo) => {
  const fixture = await createFixture();
  try {
    for (const locale of ["zh-cn", "en-us"] as const) {
      expect(
        (
          await page.request.post("/api/account/preferences", {
            data: { locale },
          })
        ).status(),
      ).toBe(200);
      const cn = locale === "zh-cn";
      for (const item of [
        {
          kind: "course",
          path: `/catalog/courses/${fixture.course.jwId}`,
          identity: [
            cn ? fixture.education.nameCn : required(fixture.education.nameEn),
            cn ? fixture.category.nameCn : required(fixture.category.nameEn),
          ],
          secondary: cn
            ? fixture.classType.nameCn
            : required(fixture.classType.nameEn),
        },
        {
          kind: "teacher",
          path: `/catalog/teachers/${fixture.teacher.id}`,
          identity: [
            cn
              ? fixture.department.nameCn
              : required(fixture.department.nameEn),
            cn ? fixture.title.nameCn : required(fixture.title.nameEn),
          ],
          secondary: required(fixture.teacher.email),
        },
        {
          kind: "section",
          path: `/catalog/sections/${fixture.section.jwId}`,
          identity: [
            cn ? fixture.teacher.nameCn : required(fixture.teacher.nameEn),
            cn ? fixture.campus.nameCn : required(fixture.campus.nameEn),
            fixture.semester.nameCn,
          ],
          secondary: required(fixture.section.remark),
        },
      ]) {
        await page.setViewportSize({ width: 390, height: 844 });
        await gotoAndWaitForReady(page, item.path);
        await page.screenshot({
          path: testInfo.outputPath(`${item.kind}-${locale}-mobile.png`),
          fullPage: true,
        });
        const identity = page.locator("[data-detail-identity]");
        const reading = page.locator("[data-detail-reading-stream]");
        const secondary = page.locator("[data-detail-scroll-container] aside");
        await expect(identity).toBeVisible();
        await expect(reading.locator("#introduction")).toContainText(
          "Readable introduction",
        );
        for (const value of item.identity)
          await expect(identity).toContainText(value);
        await expect(secondary).toContainText(item.secondary);
        const order = await page.evaluate(() => {
          const hero = document.querySelector("h1");
          const identity = document.querySelector("[data-detail-identity]");
          const reading = document.querySelector(
            "[data-detail-reading-stream]",
          );
          const secondary = document.querySelector(
            "[data-detail-scroll-container] aside",
          );
          if (!hero || !identity || !reading || !secondary)
            throw new Error("Missing catalog region");
          return [
            Boolean(
              hero.compareDocumentPosition(identity) &
                Node.DOCUMENT_POSITION_FOLLOWING,
            ),
            Boolean(
              identity.compareDocumentPosition(reading) &
                Node.DOCUMENT_POSITION_FOLLOWING,
            ),
            Boolean(
              reading.compareDocumentPosition(secondary) &
                Node.DOCUMENT_POSITION_FOLLOWING,
            ),
          ];
        });
        expect(order).toEqual([true, true, true]);
        const hero = await box(page.getByRole("heading", { level: 1 }));
        const identityBounds = await box(identity);
        const readingBounds = await box(reading);
        const secondaryBounds = await box(secondary);
        expect(hero.y + hero.height).toBeLessThanOrEqual(identityBounds.y);
        expect(identityBounds.y + identityBounds.height).toBeLessThanOrEqual(
          readingBounds.y,
        );
        expect(readingBounds.y + readingBounds.height).toBeLessThanOrEqual(
          secondaryBounds.y,
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
        if (item.kind === "section") {
          await expect(page.locator("#teachers")).toHaveCount(1);
          await expect(
            identity.getByRole("link", {
              name: new RegExp(
                cn ? fixture.teacher.nameCn : required(fixture.teacher.nameEn),
              ),
            }),
          ).toHaveAttribute("href", `/catalog/teachers/${fixture.teacher.id}`);
        }
        await page.setViewportSize({ width: 1280, height: 900 });
        const desktopReading = await box(reading);
        const desktopIdentity = await box(identity);
        const desktopSecondary = await box(secondary);
        expect(desktopIdentity.x).toBeGreaterThan(
          desktopReading.x + desktopReading.width,
        );
        expect(desktopSecondary.x).toBe(desktopIdentity.x);
        expect(desktopSecondary.y).toBeGreaterThan(
          desktopIdentity.y + desktopIdentity.height,
        );
        if (locale === "en-us")
          await page.screenshot({
            path: testInfo.outputPath(`${item.kind}-desktop.png`),
            fullPage: true,
          });
      }
    }
  } finally {
    await withE2ePrisma(async (db) => {
      await db.section.delete({ where: { id: fixture.section.id } });
      await db.teacher.delete({ where: { id: fixture.teacher.id } });
      await db.course.delete({ where: { id: fixture.course.id } });
      await db.user.delete({ where: { id: fixture.user.id } });
      await db.educationLevel.delete({ where: { id: fixture.education.id } });
      await db.courseCategory.delete({ where: { id: fixture.category.id } });
      await db.classType.delete({ where: { id: fixture.classType.id } });
      await db.department.delete({ where: { id: fixture.department.id } });
      await db.teacherTitle.delete({ where: { id: fixture.title.id } });
      await db.semester.delete({ where: { id: fixture.semester.id } });
      await db.campus.delete({ where: { id: fixture.campus.id } });
    });
  }
});
