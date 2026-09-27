import { expect, type Locator, test } from "@playwright/test";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { gotoAndWaitForReady } from "../../../utils/page-ready";

async function expectMonospace(code: Locator) {
  await expect(code).toBeVisible();
  expect(
    await code.evaluate((element) => getComputedStyle(element).fontFamily),
  ).toMatch(/mono/i);
}

test("section.student-identity-teachers", async ({ page }, testInfo) => {
  const marker = 1800000000 + Math.floor(Math.random() * 100000000);
  const fixture = await withE2ePrisma(async (db) => {
    const course = await db.course.create({
      data: {
        jwId: marker,
        code: `IDENTITY-${marker}`,
        nameCn: `课程身份${marker}`,
        nameEn: `Course identity ${marker}`,
      },
    });
    const semester = await db.semester.create({
      data: { jwId: marker, code: `identity-${marker}`, nameCn: "2026秋" },
    });
    const teacher = await db.teacher.create({
      data: { jwId: marker, nameCn: "身份教师", nameEn: "Identity Teacher" },
    });
    const section = await db.section.create({
      data: {
        jwId: marker,
        code: `SECTION-${marker}`,
        courseId: course.id,
        semesterId: semester.id,
        teachers: { connect: { id: teacher.id } },
      },
    });
    const unassigned = await db.section.create({
      data: {
        jwId: marker + 1,
        code: `UNASSIGNED-${marker}`,
        courseId: course.id,
        semesterId: semester.id,
      },
    });
    return { course, semester, teacher, section, unassigned };
  });
  try {
    await page.request.post("/api/account/preferences", {
      data: { locale: "zh-cn" },
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoAndWaitForReady(
      page,
      `/catalog/sections?search=${encodeURIComponent(fixture.course.nameCn)}`,
    );
    const row = page
      .locator("table:visible tbody tr")
      .filter({ hasText: fixture.section.code });
    await expect(row).toContainText(fixture.course.nameCn);
    await expect(row).toContainText(fixture.teacher.nameCn);
    await expectMonospace(row.locator('[data-slot="catalog-code"]'));

    await gotoAndWaitForReady(
      page,
      `/search?q=${encodeURIComponent(fixture.course.nameCn)}`,
    );
    const withTeacher = page
      .getByRole("option")
      .filter({ hasText: fixture.section.code });
    const withoutTeacher = page
      .getByRole("option")
      .filter({ hasText: fixture.unassigned.code });
    await expect(withTeacher).toBeVisible();
    await expect(withoutTeacher).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("section-identity-search.png"),
      fullPage: true,
    });
    await expect(withTeacher.locator(".font-medium")).toHaveText(
      `${fixture.course.nameCn} · ${fixture.teacher.nameCn}`,
    );
    await expect(withoutTeacher.locator(".font-medium")).toHaveText(
      fixture.course.nameCn,
    );
    await expectMonospace(withTeacher.locator('[data-slot="catalog-code"]'));
    await expectMonospace(withoutTeacher.locator('[data-slot="catalog-code"]'));

    await gotoAndWaitForReady(
      page,
      `/catalog/sections/${fixture.section.jwId}`,
    );
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText(fixture.course.nameCn);
    await expect(heading).not.toContainText(fixture.section.code);
    const overview = page
      .getByRole("complementary")
      .filter({ hasText: fixture.section.code });
    await expect(
      page.locator("[data-detail-identity]").getByRole("link", {
        name: `${fixture.teacher.nameCn} (${fixture.teacher.nameEn})`,
      }),
    ).toBeVisible();
    await expectMonospace(
      overview.locator("dd").filter({ hasText: fixture.section.code }),
    );
    const heroCode = page
      .locator("header")
      .filter({ has: heading })
      .locator('[data-slot="catalog-code"]');
    expect(
      await heroCode.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize),
      ),
    ).toBeLessThan(
      await heading.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize),
      ),
    );

    await page.setViewportSize({ width: 375, height: 850 });
    await gotoAndWaitForReady(
      page,
      `/catalog/sections?search=${encodeURIComponent(fixture.course.nameCn)}`,
    );
    const card = page
      .locator('[data-testid="catalog-results-cards"] a')
      .filter({ hasText: fixture.section.code });
    await expect(card).toContainText(fixture.course.nameCn);
    await expect(card).toContainText(fixture.teacher.nameCn);
    await expectMonospace(card.locator('[data-slot="catalog-code"]'));
  } finally {
    await withE2ePrisma(async (db) => {
      await db.section.deleteMany({ where: { courseId: fixture.course.id } });
      await db.course.delete({ where: { id: fixture.course.id } });
      await db.teacher.delete({ where: { id: fixture.teacher.id } });
      await db.semester.delete({ where: { id: fixture.semester.id } });
    });
  }
});
