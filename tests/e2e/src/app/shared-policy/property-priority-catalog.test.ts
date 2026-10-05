import { expect, type Locator } from "@playwright/test";
import { createCatalogContractFixture } from "../../../../shared/catalog-contract-fixture";
import type { TestPrismaClient } from "../../../../shared/prisma";
import { test } from "../../../utils/catalog-browser-fixture";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import {
  assertPriorityView,
  type PriorityField,
  type VisiblePriorityField,
} from "../../../utils/property-priority";

const field = (locator: Locator, expected: string): VisiblePriorityField => ({
  locator,
  expected,
});
const text = (scope: Locator, expected: string) =>
  field(
    scope
      .getByText(expected, { exact: /^\d+(?:\.\d+)?$/.test(expected) })
      .filter({ visible: true })
      .first(),
    expected,
  );
const internal = (id: number) => ({ value: String(id) });
const name = (
  value: { nameCn: string; nameEn: string | null },
  locale: string,
) => (locale === "en-us" ? (value.nameEn ?? value.nameCn) : value.nameCn);
function secondaryName(
  scope: Locator,
  value: { nameCn: string; nameEn: string | null },
  locale: "zh-cn" | "en-us",
): PriorityField {
  return locale === "zh-cn"
    ? { absentInLocale: locale, text: value.nameEn ?? "" }
    : field(
        scope.locator('[data-slot="entity-secondary-name"]').first(),
        value.nameCn,
      );
}
async function fixture(owner: TestPrismaClient) {
  const catalog = await createCatalogContractFixture(owner);
  return owner.$transaction(async (db) => {
    const named = (suffix: string) => ({
      nameCn: `${suffix}${catalog.marker}`,
      nameEn: `${suffix} ${catalog.marker}`,
    });
    const education = await db.educationLevel.create({ data: named("Level") });
    const category = await db.courseCategory.create({
      data: named("Category"),
    });
    const classType = await db.classType.create({ data: named("Class") });
    const courseType = await db.courseType.create({ data: named("Type") });
    const campus = await db.campus.create({
      data: { ...named("Campus"), jwId: catalog.base, code: catalog.marker },
    });
    const examMode = await db.examMode.create({ data: named("Exam") });
    const language = await db.teachLanguage.create({ data: named("Language") });
    const roomType = await db.roomType.create({
      data: { ...named("Room"), jwId: catalog.base, code: catalog.marker },
    });
    const adminClass = await db.adminClass.create({
      data: { ...named("ClassGroup"), jwId: catalog.base },
    });
    const semester = await db.semester.update({
      where: { id: catalog.semester.id },
      data: { nameCn: "2026年秋季学期" },
    });
    for (const [index, teacher] of catalog.teachers.entries())
      catalog.teachers[index] = await db.teacher.update({
        where: { id: teacher.id },
        data: { id: catalog.base + 50 + index },
      });
    for (const [index, course] of catalog.courses.entries())
      catalog.courses[index] = await db.course.update({
        where: { id: course.id },
        data: {
          id: catalog.base + 60 + index,
          educationLevelId: education.id,
          categoryId: category.id,
          classTypeId: classType.id,
          typeId: courseType.id,
        },
      });
    for (const [index, section] of catalog.sections.entries())
      catalog.sections[index] = await db.section.update({
        where: { id: section.id },
        data: {
          id: catalog.base + 70 + index,
          campusId: campus.id,
          credits: 3.5,
          stdCount: 17,
          limitCount: 27,
          period: 31,
          actualPeriods: 29,
          theoryPeriods: 11,
          practicePeriods: 12,
          experimentPeriods: 13,
          machinePeriods: 14,
          designPeriods: 15,
          testPeriods: 16,
          timesPerWeek: 5,
          periodsPerWeek: 4,
          examModeId: examMode.id,
          teachLanguageId: language.id,
          roomTypeId: roomType.id,
          graduateAndPostgraduate: true,
          remark: `Remark ${catalog.marker}`,
          adminClasses: { connect: { id: adminClass.id } },
        },
      });
    return {
      catalog,
      education,
      category,
      classType,
      courseType,
      campus,
      examMode,
      language,
      roomType,
      adminClass,
      semester,
    };
  });
}

for (const locale of ["zh-cn", "en-us"] as const)
  for (const width of [1280, 390]) {
    for (const domain of ["Course", "Section", "Teacher"] as const) {
      test(`ui.model-property-priority-catalog-views ${locale}/${width} ${domain}`, {
        tag: `@${domain}/Web`,
      }, async ({ page, isolatedWorker, catalogFlow }) => {
        test.setTimeout(120_000);
        page.setDefaultTimeout(5_000);
        await catalogFlow.run(
          async () => {
            const data = await fixture(isolatedWorker.database.owner);
            const {
              catalog,
              education,
              category,
              classType,
              courseType,
              campus,
              examMode,
              language,
              roomType,
              adminClass,
            } = data;
            const course = catalog.courses[0],
              teacher = catalog.teachers[0],
              section = catalog.sections[0];
            await page.context().clearCookies();
            await page.context().addCookies([
              {
                name: "NEXT_LOCALE",
                value: locale,
                url: isolatedWorker.origin,
              },
            ]);
            const semester =
              locale === "en-us" ? "Fall 2026" : "2026年秋季学期";

            await page.setViewportSize({ width, height: 844 });

            for (const kind of ["course", "teacher", "section"] as const) {
              if (kind !== domain.toLowerCase()) continue;
              const entity =
                kind === "course"
                  ? course
                  : kind === "teacher"
                    ? teacher
                    : section;
              const href = `/catalog/${kind}s/${kind === "teacher" ? teacher.id : entity.jwId}`;
              await gotoAndWaitForReady(
                page,
                `/catalog/${kind}s?search=${catalog.marker}`,
              );
              const main = page.locator("#main-content");
              const row =
                width === 1280
                  ? main
                      .getByRole("row")
                      .filter({ has: page.locator(`a[href="${href}"]`) })
                      .first()
                  : main
                      .getByRole("listitem")
                      .filter({ has: page.locator(`a[href="${href}"]`) })
                      .first();
              const identity =
                width === 1280
                  ? row.locator(`a[href="${href}"]`).first()
                  : row.locator('[data-slot="item-title"]');
              const primary: Record<string, PriorityField> =
                kind === "teacher"
                  ? {
                      "teacher.namePrimary": field(
                        identity,
                        name(teacher, locale),
                      ),
                    }
                  : kind === "course"
                    ? {
                        "course.namePrimary": field(
                          identity,
                          name(course, locale),
                        ),
                      }
                    : {
                        "section.course.namePrimary": field(
                          identity,
                          name(course, locale),
                        ),
                        "section.teachers.namePrimary": field(
                          row
                            .getByText(name(teacher, locale), { exact: false })
                            .filter({ visible: true })
                            .first(),
                          name(teacher, locale),
                        ),
                      };
              const secondary: Record<string, PriorityField> =
                kind === "course"
                  ? {
                      "course.nameSecondary": secondaryName(
                        identity,
                        course,
                        locale,
                      ),
                      "course.code": text(row, course.code),
                      "course.educationLevel.namePrimary": text(
                        row,
                        name(education, locale),
                      ),
                      "course.category.namePrimary": text(
                        row,
                        name(category, locale),
                      ),
                      "course.classType.namePrimary": text(
                        row,
                        name(classType, locale),
                      ),
                    }
                  : kind === "teacher"
                    ? {
                        "teacher.nameSecondary": secondaryName(
                          identity,
                          teacher,
                          locale,
                        ),
                        "teacher.department.namePrimary": text(
                          row,
                          name(catalog.departments[0], locale),
                        ),
                        "teacher.teacherTitle.namePrimary": text(
                          row,
                          name(catalog.titles[0], locale),
                        ),
                        "teacher.email": text(row, teacher.email ?? ""),
                        "teacher._count.sections": text(row, "1"),
                        "teacher.code": text(row, teacher.code ?? ""),
                      }
                    : {
                        "section.course.nameSecondary": secondaryName(
                          identity,
                          course,
                          locale,
                        ),
                        "section.semester.nameCn": field(
                          row
                            .getByText(semester, { exact: false })
                            .filter({ visible: true })
                            .first(),
                          semester,
                        ),
                        "section.campus.namePrimary": text(
                          row,
                          name(campus, locale),
                        ),
                        "section.code": text(row, section.code),
                        "section.credits": field(
                          row
                            .getByText("3.5", { exact: false })
                            .filter({ visible: true })
                            .first(),
                          "3.5",
                        ),
                        "section.stdCount": field(
                          row
                            .getByText("17 / 27", { exact: false })
                            .filter({ visible: true })
                            .first(),
                          "17",
                        ),
                        "section.limitCount": field(
                          row
                            .getByText("17 / 27", { exact: false })
                            .filter({ visible: true })
                            .first(),
                          "27",
                        ),
                      };

              await assertPriorityView({
                scope: row,
                identity,
                primary,
                secondary,
                tertiary: {
                  [`${kind}.id`]: internal(entity.id),
                  [`${kind}.jwId`]: internal(entity.jwId),
                  ...(kind === "teacher"
                    ? { "teacher.personId": internal(teacher.personId ?? 0) }
                    : {}),
                },
              });
              await gotoAndWaitForReady(page, href);
              const heading = page.getByRole("heading", { level: 1 });
              const aside = main.locator("aside");
              const detailPrimary: Record<string, PriorityField> =
                kind === "teacher"
                  ? {
                      "teacher.namePrimary": field(
                        heading,
                        name(teacher, locale),
                      ),
                    }
                  : kind === "course"
                    ? {
                        "course.namePrimary": field(
                          heading,
                          name(course, locale),
                        ),
                      }
                    : {
                        "section.course.namePrimary": field(
                          heading,
                          name(course, locale),
                        ),
                        "section.teachers.namePrimary": field(
                          main
                            .locator("[data-detail-identity]")
                            .getByRole("link", { name: name(teacher, locale) }),
                          name(teacher, locale),
                        ),
                      };
              const detailSecondary: Record<string, PriorityField> =
                kind === "course"
                  ? {
                      "course.nameSecondary": secondaryName(
                        heading,
                        course,
                        locale,
                      ),
                      "course.code": field(
                        main.getByTestId("course-public-code"),
                        course.code,
                      ),
                      "course.educationLevel.namePrimary": text(
                        main.locator("[data-detail-identity]"),
                        name(education, locale),
                      ),
                      "course.category.namePrimary": text(
                        main.locator("[data-detail-identity]"),
                        name(category, locale),
                      ),
                      "course.classType.namePrimary": text(
                        aside,
                        name(classType, locale),
                      ),
                      "course.type.namePrimary": text(
                        aside,
                        name(courseType, locale),
                      ),
                    }
                  : kind === "teacher"
                    ? {
                        "teacher.nameSecondary": secondaryName(
                          heading,
                          teacher,
                          locale,
                        ),
                        "teacher.department.namePrimary": text(
                          main.locator("[data-detail-identity]"),
                          name(catalog.departments[0], locale),
                        ),
                        "teacher.teacherTitle.namePrimary": text(
                          main.locator("[data-detail-identity]"),
                          name(catalog.titles[0], locale),
                        ),
                        "teacher.email": text(aside, teacher.email ?? ""),
                        "teacher.telephone": text(
                          aside,
                          teacher.telephone ?? "",
                        ),
                        "teacher.mobile": text(aside, teacher.mobile ?? ""),
                        "teacher.address": text(aside, teacher.address ?? ""),
                      }
                    : {
                        "section.course.nameSecondary": text(
                          heading.locator(".."),
                          locale === "en-us"
                            ? course.nameCn
                            : (course.nameEn ?? ""),
                        ),
                        "section.semester.nameCn": text(
                          main.locator("[data-detail-identity]"),
                          semester,
                        ),
                        "section.campus.namePrimary": text(
                          main.locator("[data-detail-identity]"),
                          name(campus, locale),
                        ),
                        "section.code": text(aside, section.code),
                        "section.credits": text(aside, "3.5"),
                        "section.stdCount": field(
                          aside.getByText("17 / 27", { exact: true }),
                          "17",
                        ),
                        "section.limitCount": field(
                          aside.getByText("17 / 27", { exact: true }),
                          "27",
                        ),
                        "section.period": field(
                          aside.getByText("31 / 29", { exact: true }),
                          "31",
                        ),
                        "section.actualPeriods": field(
                          aside.getByText("31 / 29", { exact: true }),
                          "29",
                        ),
                        "section.examMode.namePrimary": text(
                          aside,
                          name(examMode, locale),
                        ),
                        "section.remark": text(
                          aside,
                          `Remark ${catalog.marker}`,
                        ),
                        "section.adminClasses.namePrimary": text(
                          aside,
                          name(adminClass, locale),
                        ),
                        "section.timesPerWeek": field(
                          aside.getByText("5 x 4", { exact: true }),
                          "5",
                        ),
                        "section.periodsPerWeek": field(
                          aside.getByText("5 x 4", { exact: true }),
                          "4",
                        ),
                        ...Object.fromEntries(
                          [
                            "theoryPeriods",
                            "practicePeriods",
                            "experimentPeriods",
                            "machinePeriods",
                            "designPeriods",
                            "testPeriods",
                          ].map((key, index) => [
                            `section.${key}`,
                            text(aside, String(11 + index)),
                          ]),
                        ),
                        "section.teachLanguage.namePrimary": text(
                          aside,
                          name(language, locale),
                        ),
                        "section.roomType.namePrimary": text(
                          aside,
                          name(roomType, locale),
                        ),
                        "section.graduateAndPostgraduate": text(
                          aside,
                          locale === "en-us" ? "Yes" : "是",
                        ),
                      };
              await assertPriorityView({
                scope: main,
                identity: heading,
                primary: detailPrimary,
                secondary: detailSecondary,
                tertiary: {
                  [`${kind}.id`]: internal(entity.id),
                  [`${kind}.jwId`]: internal(entity.jwId),
                  ...(kind === "teacher"
                    ? { "teacher.personId": internal(teacher.personId ?? 0) }
                    : {}),
                },
              });
              if (kind !== "section") {
                const history = main.locator("#sections");
                const offering =
                  width === 1280
                    ? history
                        .getByRole("row")
                        .filter({
                          has: page.locator(
                            `a[href="/catalog/sections/${section.jwId}"]`,
                          ),
                        })
                        .first()
                    : history
                        .locator(
                          `a[href="/catalog/sections/${section.jwId}"]:visible`,
                        )
                        .first();
                const identity =
                  kind === "course"
                    ? offering.getByText(semester, { exact: true }).first()
                    : offering
                        .getByText(name(course, locale), { exact: false })
                        .first();
                await assertPriorityView({
                  scope: offering,
                  identity,
                  primary:
                    kind === "course"
                      ? { "section.semester.nameCn": field(identity, semester) }
                      : {
                          "section.course.namePrimary": field(
                            identity,
                            name(course, locale),
                          ),
                        },
                  secondary:
                    kind === "course"
                      ? {
                          "section.teachers.namePrimary": field(
                            offering
                              .getByText(name(teacher, locale), {
                                exact: false,
                              })
                              .first(),
                            name(teacher, locale),
                          ),
                          "section.code": text(offering, section.code),
                          "section.campus.namePrimary": field(
                            offering
                              .getByText(name(campus, locale), { exact: false })
                              .first(),
                            name(campus, locale),
                          ),
                          "section.stdCount": field(
                            offering
                              .getByText("17 / 27", { exact: false })
                              .first(),
                            "17",
                          ),
                          "section.limitCount": field(
                            offering
                              .getByText("17 / 27", { exact: false })
                              .first(),
                            "27",
                          ),
                        }
                      : {
                          "section.semester.nameCn": text(offering, semester),
                          "section.code": text(offering, section.code),
                          "section.credits": field(
                            offering.getByText("3.5", { exact: false }).first(),
                            "3.5",
                          ),
                        },
                  tertiary: {
                    "section.id": internal(section.id),
                    "section.jwId": internal(section.jwId),
                  },
                });
              }
              expect(
                await page.evaluate(() => document.documentElement.scrollWidth),
              ).toBeLessThanOrEqual(width);
            }
          },
          { anonymousCourseCount: 2 },
        );
      });
    }
  }
