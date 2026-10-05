import { expect } from "vitest";
import {
  findCourseDetailByJwId,
  findSectionDetailByJwId,
} from "@/features/catalog/server/course-section-read-queries";
import { listSectionSummaries } from "@/features/catalog/server/section-summary-read-model";
import { findTeacherDetailById } from "@/features/catalog/server/teacher-summary-read-model";
import { getSectionPage } from "@/features/section-detail/server/section-page-data";
import { catalogReadTest as it } from "../shared/catalog-read-fixture";

it("section.relational-course-filter", { tags: ["@Catalog/Service"] }, async ({
  catalogRead: { run, fixture, request },
}) => {
  await run(async () => {
    const [a, b] = fixture.courses;
    const pagination = { page: 1, pageSize: 20 };
    const match = await request(() =>
      listSectionSummaries({
        filters: { courseId: String(a.id), courseJwId: String(a.jwId) },
        pagination,
      }),
    );
    expect(match.data.map((row) => row.id)).toEqual([fixture.sections[0].id]);
    expect(match.pagination.total).toBe(1);
    const mismatch = await request(() =>
      listSectionSummaries({
        filters: { courseId: String(a.id), courseJwId: String(b.jwId) },
        pagination,
      }),
    );
    expect(mismatch.data).toEqual([]);
    expect(mismatch.pagination.total).toBe(0);
  });
});

it("section.bounded-related-sections", { tags: ["@Catalog/Service"] }, async ({
  catalogRead: { run, db, fixture, request },
}) => {
  await run(async () => {
    const courseId = fixture.courses[0].id;
    const semesterId = (
      await db.semester.create({
        data: {
          jwId: fixture.base + 1,
          code: `${fixture.marker}-newer`,
          nameCn: "2027春",
        },
      })
    ).id;
    await db.section.create({
      data: {
        jwId: fixture.base + 29,
        code: "AAAA-OLDER",
        courseId,
        semesterId: fixture.semester.id,
      },
    });
    // Reverse insert order makes an omitted unique tie-breaker observable.
    const expected: number[] = [];
    for (let offset = 28; offset >= 2; offset--) {
      await db.section.create({
        data: {
          jwId: fixture.base + offset,
          code: "EQUAL-CODE",
          courseId,
          semesterId,
          retiredAt: offset >= 27 ? new Date() : null,
        },
      });
      if (offset < 27) expected.push(fixture.base + offset);
    }
    const result = await request(() =>
      getSectionPage(fixture.sections[0].jwId),
    );
    expect(result?.section.otherCourseSectionCount).toBe(26);
    expect(
      result?.section.otherCourseSections.map((section) => section.jwId),
    ).toEqual(expected.sort((a, b) => a - b).slice(0, 20));
  });
});

it("course.public-detail-fields", { tags: ["@Catalog/Service"] }, async ({
  catalogRead: { run, fixture, request },
}) => {
  await run(async () => {
    const detail = await request(() =>
      findCourseDetailByJwId(fixture.courses[0].jwId),
    );
    const teachers = detail?.sections[0].teachers;
    expect(teachers).toHaveLength(1);
    expect(teachers?.[0]).toMatchObject({
      id: fixture.teachers[0].id,
      namePrimary: fixture.teachers[0].nameCn,
    });
    for (const field of [
      "email",
      "telephone",
      "mobile",
      "address",
      "age",
      "postcode",
      "qq",
      "wechat",
    ])
      expect(teachers?.[0]).not.toHaveProperty(field);
    expect(JSON.stringify(detail)).not.toContain("source-");
  });
});

it("section.public-teacher-reference", { tags: ["@Catalog/Service"] }, async ({
  catalogRead: { run, fixture, request },
}) => {
  await run(async () => {
    for (const locale of ["zh-cn", "en-us"] as const) {
      const detail = await request(() =>
        findSectionDetailByJwId(fixture.sections[0].jwId, locale),
      );
      const teacher = fixture.teachers[0];
      const department = fixture.departments[0];
      const title = fixture.titles[0];
      const localized = (row: {
        nameCn: string | null;
        nameEn: string | null;
      }) => ({
        nameCn: row.nameCn,
        nameEn: row.nameEn,
        namePrimary: locale === "en-us" ? row.nameEn : row.nameCn,
        nameSecondary: locale === "en-us" ? row.nameCn : row.nameEn,
      });
      // Exact projections also reject leaked contact/source fields and extra nested data.
      expect(detail?.teachers).toEqual([
        {
          id: teacher.id,
          jwId: teacher.jwId,
          personId: teacher.personId,
          code: teacher.code,
          ...localized(teacher),
          department: {
            id: department.id,
            code: department.code,
            isCollege: department.isCollege,
            ...localized(department),
          },
          teacherTitle: {
            id: title.id,
            jwId: title.jwId,
            code: title.code,
            enabled: title.enabled,
            ...localized(title),
          },
        },
      ]);
      expect(JSON.stringify(detail)).not.toContain("source-");
    }
  });
});

it("teacher.public-detail-fields", { tags: ["@Catalog/Service"] }, async ({
  catalogRead: { run, fixture, request },
}) => {
  await run(async () => {
    const teacher = fixture.teachers[0];
    for (const locale of ["zh-cn", "en-us"] as const) {
      const detail = await request(() =>
        findTeacherDetailById(teacher.id, locale),
      );
      expect(detail).toEqual({
        id: teacher.id,
        jwId: teacher.jwId,
        personId: teacher.personId,
        code: teacher.code,
        nameCn: teacher.nameCn,
        nameEn: teacher.nameEn,
        namePrimary: locale === "en-us" ? teacher.nameEn : teacher.nameCn,
        nameSecondary: locale === "en-us" ? teacher.nameCn : teacher.nameEn,
        email: teacher.email,
        telephone: teacher.telephone,
        mobile: teacher.mobile,
        address: teacher.address,
        departmentId: teacher.departmentId,
        teacherTitleId: teacher.teacherTitleId,
        department: expect.objectContaining({
          id: fixture.departments[0].id,
          namePrimary:
            locale === "en-us"
              ? fixture.departments[0].nameEn
              : fixture.departments[0].nameCn,
        }),
        teacherTitle: expect.objectContaining({
          id: fixture.titles[0].id,
          namePrimary:
            locale === "en-us"
              ? fixture.titles[0].nameEn
              : fixture.titles[0].nameCn,
        }),
        _count: { sections: 1 },
        sections: [
          expect.objectContaining({
            id: fixture.sections[0].id,
            jwId: fixture.sections[0].jwId,
            code: fixture.sections[0].code,
            course: expect.objectContaining({ id: fixture.courses[0].id }),
            semester: expect.objectContaining({ id: fixture.semester.id }),
          }),
        ],
      });
      for (const field of ["age", "postcode", "qq", "wechat"])
        expect(detail).not.toHaveProperty(field);
      expect(JSON.stringify(detail)).not.toContain("source-");
    }
  });
});
