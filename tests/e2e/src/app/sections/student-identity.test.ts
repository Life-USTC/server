import { expect, type Locator } from "@playwright/test";
import type { TestPrismaClient } from "../../../../shared/prisma";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test } from "../../../utils/personal-preferences-fixture";
import {
  expectPublicIdentityEffectsEmpty,
  publicIdentityState,
} from "../../../utils/public-identity-state";

async function expectMonospace(code: Locator) {
  await expect(code).toBeVisible();
  expect(
    await code.evaluate((element) => getComputedStyle(element).fontFamily),
  ).toMatch(/mono/i);
}

async function createIdentityFixture(db: TestPrismaClient) {
  const marker = 1_800_000_000;
  return db.$transaction(async (db) => {
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
      data: {
        jwId: marker,
        nameCn: "身份教师",
        nameEn: "Identity Teacher",
      },
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
}

async function initialIdentityState(db: TestPrismaClient) {
  const baseline = await publicIdentityState(db);
  expect(baseline.users).toEqual([]);
  expect(baseline.courses).toHaveLength(1);
  expect(baseline.semesters).toHaveLength(1);
  expect(baseline.teachers).toHaveLength(1);
  expect(baseline.sections).toHaveLength(2);
  expect(baseline.comments).toEqual([]);
  expect(baseline.descriptions).toEqual([]);
  await expectPublicIdentityEffectsEmpty(db);
  return baseline;
}

test("section.student-identity-teachers", { tag: "@Section/Web" }, async ({
  page,
  isolatedWorker,
  preferenceFlow,
  run,
}) => {
  await run(async () => {
    const db = isolatedWorker.database.owner;
    const fixture = await createIdentityFixture(db);

    const baseline = await initialIdentityState(db);
    await preferenceFlow.run(async () => {
      const locale = await preferenceFlow.http(() =>
        page.request.post("/api/account/preferences", {
          data: { locale: "zh-cn" },
        }),
      );
      expect(locale.status()).toBe(200);
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
    });
    expect(await publicIdentityState(db)).toEqual(baseline);
    await expectPublicIdentityEffectsEmpty(db);
  });
});

test("search.section-student-identity-teachers", {
  tag: "@Search/Web",
}, async ({ page, isolatedWorker, preferenceFlow, run }) => {
  await run(async () => {
    const db = isolatedWorker.database.owner;
    const fixture = await createIdentityFixture(db);

    const baseline = await initialIdentityState(db);
    await preferenceFlow.run(async () => {
      const locale = await preferenceFlow.http(() =>
        page.request.post("/api/account/preferences", {
          data: { locale: "zh-cn" },
        }),
      );
      expect(locale.status()).toBe(200);
      await page.setViewportSize({ width: 1280, height: 900 });
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

      await expect(withTeacher.locator(".font-medium")).toHaveText(
        `${fixture.course.nameCn} · ${fixture.teacher.nameCn}`,
      );
      await expect(withoutTeacher.locator(".font-medium")).toHaveText(
        fixture.course.nameCn,
      );
      await expectMonospace(withTeacher.locator('[data-slot="catalog-code"]'));
      await expectMonospace(
        withoutTeacher.locator('[data-slot="catalog-code"]'),
      );
    });
    expect(await publicIdentityState(db)).toEqual(baseline);
    await expectPublicIdentityEffectsEmpty(db);
  });
});
