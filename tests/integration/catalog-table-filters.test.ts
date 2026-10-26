import { expect } from "vitest";
import {
  listCourseTableSummaries,
  listSectionTableSummaries,
  listTeacherTableSummaries,
} from "@/features/catalog/server/catalog-table-read-model";
import { getTeacherListFilterOptions } from "@/features/catalog/server/public-catalog-filter-options";
import { listSectionSummaries } from "@/features/catalog/server/section-summary-read-model";
import { catalogReadTest as it } from "../shared/catalog-read-fixture";

it("course.web-table-filters", { tags: ["@Course/Service"] }, async ({
  catalogRead: { run, db, fixture, request },
}) => {
  await run(async () => {
    const categories = await Promise.all(
      [0, 1].map((i) =>
        db.courseCategory.create({
          data: { nameCn: `分类${i}` },
        }),
      ),
    );
    const level = await db.educationLevel.create({
      data: { nameCn: "本科" },
    });
    const classType = await db.classType.create({
      data: { nameCn: "专业" },
    });
    for (const [i, course] of fixture.courses.entries()) {
      await db.course.update({
        where: { id: course.id },
        data: {
          categoryId: categories[i].id,
          educationLevelId: level.id,
          classTypeId: classType.id,
        },
      });
    }
    const filters = {
      name: "contract COURSE",
      code: fixture.marker,
      categoryId: `${categories[1].id},${categories[0].id}`,
      educationLevelId: String(level.id),
      classTypeId: String(classType.id),
    };
    const ids: number[] = [];
    for (const page of [1, 2, 3]) {
      const result = await request(() =>
        listCourseTableSummaries({
          filters,
          pagination: { page, pageSize: 1 },
          locale: "en-us",
        }),
      );
      expect(result.pagination).toEqual({
        page,
        pageSize: 1,
        total: 2,
        totalPages: 2,
      });
      ids.push(...result.data.map((row) => row.id));
      if (page === 3) expect(result.data).toEqual([]);
      else
        expect(result.data[0].namePrimary).toBe(
          fixture.courses[page - 1].nameEn,
        );
    }
    expect(ids).toEqual(fixture.courses.map((row) => row.id));
    const single = await request(() =>
      listCourseTableSummaries({
        filters: { ...filters, categoryId: String(categories[0].id) },
        pagination: { page: 1, pageSize: 20 },
      }),
    );
    expect(single.data.map((row) => row.id)).toEqual([fixture.courses[0].id]);
    const injection = await request(() =>
      listCourseTableSummaries({
        filters: { name: "' OR TRUE --" },
        pagination: { page: 1, pageSize: 20 },
      }),
    );
    expect(injection.pagination.total).toBe(0);
    expect(injection.data).toEqual([]);
  });
});

it("teacher.web-table-filters", { tags: ["@Teacher/Service"] }, async ({
  catalogRead: { run, db, fixture, request },
}) => {
  await run(async () => {
    const extra = await Promise.all(
      [2, 3].map((i) =>
        db.teacher.create({
          data: {
            jwId: fixture.base + i,
            nameCn: fixture.teachers[0].nameCn,
            nameEn: fixture.teachers[0].nameEn,
            code: `T${i}`,
            departmentId: fixture.departments[0].id,
          },
        }),
      ),
    );
    await db.section.create({
      data: {
        jwId: fixture.base + 2,
        code: "extra",
        courseId: fixture.courses[0].id,
        teachers: { connect: { id: fixture.teachers[1].id } },
      },
    });
    await db.section.create({
      data: {
        jwId: fixture.base + 3,
        code: "retired",
        courseId: fixture.courses[0].id,
        teachers: { connect: { id: extra[1].id } },
        retiredAt: new Date("2026-10-01T00:00:00Z"),
      },
    });
    const expectedRows = [...fixture.teachers, ...extra];
    const comparisons = [
      ["eq", "0", undefined, [2, 3]],
      ["ne", "1", undefined, [1, 2, 3]],
      ["gt", "1", undefined, [1]],
      ["gte", "1", undefined, [0, 1]],
      ["lt", "1", undefined, [2, 3]],
      ["lte", "1", undefined, [0, 2, 3]],
      ["between", "0", "1", [0, 2, 3]],
    ] as const;
    for (const [
      sectionCountOp,
      sectionCount,
      sectionCountMax,
      indices,
    ] of comparisons) {
      const observed: number[] = [];
      for (let page = 1; page <= indices.length + 1; page++) {
        const result = await request(() =>
          listTeacherTableSummaries({
            filters: {
              name: fixture.marker,
              sectionCount,
              sectionCountOp,
              sectionCountMax,
            },
            pagination: { page, pageSize: 1 },
          }),
        );
        expect(result.pagination.total).toBe(indices.length);
        observed.push(...result.data.map((row) => row.id));
      }
      expect(observed).toEqual(indices.map((index) => expectedRows[index].id));
    }
    const filtered = await request(() =>
      listTeacherTableSummaries({
        filters: {
          name: "same NAME",
          code: "teacher-1",
          email: "-1@EXAMPLE.test",
          departmentId: fixture.departments.map((row) => row.id).join(","),
          teacherTitleId: fixture.titles.map((row) => row.id).join(","),
        },
        locale: "en-us",
        pagination: { page: 1, pageSize: 20 },
      }),
    );
    expect(filtered.data.map((row) => row.id)).toEqual([
      fixture.teachers[1].id,
    ]);
    expect(filtered.data[0]._count.sections).toBe(2);
    expect(JSON.stringify(filtered)).not.toContain("source-");
    const options = await request(() =>
      getTeacherListFilterOptions("en-us", "http://localhost:3000"),
    );
    expect(options.teacherTitles.map((row) => row.id)).toEqual(
      fixture.titles.map((row) => row.id),
    );
  });
});

it("section.web-table-filters", { tags: ["@Section/Service"] }, async ({
  catalogRead: { run, db, fixture, request },
}) => {
  await run(async () => {
    const campus = await db.campus.create({
      data: { jwId: fixture.base, nameCn: "东区", nameEn: "East" },
    });
    const category = await db.courseCategory.create({
      data: { nameCn: "专业", nameEn: "Major" },
    });
    const classType = await db.classType.create({
      data: { nameCn: "必修", nameEn: "Required" },
    });
    const level = await db.educationLevel.create({
      data: { nameCn: "本科", nameEn: "Undergraduate" },
    });
    await db.course.updateMany({
      where: { id: { in: fixture.courses.map((row) => row.id) } },
      data: {
        categoryId: category.id,
        classTypeId: classType.id,
        educationLevelId: level.id,
      },
    });
    for (const [i, section] of fixture.sections.entries()) {
      await db.section.update({
        where: { id: section.id },
        data: {
          credits: i * 2.5,
          stdCount: i * 10,
          limitCount: i * 15,
          campusId: campus.id,
          openDepartmentId: fixture.departments[i].id,
          ...(i === 1
            ? { teachers: { connect: { id: fixture.teachers[0].id } } }
            : {}),
        },
      });
    }
    const third = await db.section.create({
      data: {
        jwId: fixture.base + 2,
        code: "three",
        courseId: fixture.courses[0].id,
        semesterId: fixture.semester.id,
        credits: 5,
        stdCount: 20,
        limitCount: 30,
      },
    });
    await db.section.create({
      data: {
        jwId: fixture.base + 3,
        code: "null",
        courseId: fixture.courses[0].id,
        semesterId: fixture.semester.id,
      },
    });
    await db.section.create({
      data: {
        jwId: fixture.base + 4,
        code: "retired",
        courseId: fixture.courses[0].id,
        semesterId: fixture.semester.id,
        credits: 2.5,
        stdCount: 10,
        limitCount: 15,
        retiredAt: new Date("2026-10-01T00:00:00Z"),
      },
    });

    const expected = [...fixture.sections, third];
    for (const [field, threshold] of [
      ["credits", "2.5"],
      ["stdCount", "10"],
      ["limitCount", "15"],
    ] as const) {
      for (const [op, indices] of [
        ["eq", [1]],
        ["ne", [0, 2]],
        ["gt", [2]],
        ["gte", [1, 2]],
        ["lt", [0]],
        ["lte", [0, 1]],
        ["between", [1, 2]],
      ] as const) {
        const result = await request(() =>
          listSectionTableSummaries({
            filters: {
              [field]: threshold,
              [`${field}Op`]: op,
              [`${field}Max`]: String(Number(threshold) * 2),
            },
            pagination: { page: 1, pageSize: 20 },
          }),
        );
        expect(
          result.data.map((row) => row.id),
          `${field} ${op}`,
        ).toEqual(indices.map((index) => expected[index].id));
        expect(result.pagination.total).toBe(indices.length);
      }
    }
    const combined = await request(() =>
      listSectionTableSummaries({
        filters: {
          semesterId: `${fixture.semester.id},2147483647`,
          campusId: String(campus.id),
          departmentId: fixture.departments.map((row) => row.id).join(","),
          categoryId: String(category.id),
          educationLevelId: String(level.id),
          classTypeId: String(classType.id),
          courseName: "Contract COURSE",
          courseCode: "course-1",
          sectionCode: "section-1",
          teacher: "Same Name",
          teacherCount: "2",
          teacherCountOp: "gte",
          credits: "2",
          creditsOp: "gt",
          search:
            'teacher:missing coursecode:missing sectioncode:missing credits:0 campus:East department:"Contract Department" category:Major level:Undergraduate classtype:Required semester:2026 sort:teacher order:desc',
        },
        pagination: { page: 1, pageSize: 1 },
      }),
    );
    expect(combined.data.map((row) => row.id)).toEqual([
      fixture.sections[1].id,
    ]);
    expect(combined.pagination.total).toBe(1);
    const zeroTeachers = await request(() =>
      listSectionTableSummaries({
        filters: { teacherCount: "0" },
        pagination: { page: 1, pageSize: 1 },
      }),
    );
    expect(zeroTeachers.data.map((row) => row.id)).toEqual([third.id]);
    expect(zeroTeachers.pagination).toEqual({
      page: 1,
      pageSize: 1,
      total: 2,
      totalPages: 2,
    });
    for (const filters of [
      {},
      { search: "Contract Course" },
      {
        search:
          'campus:East department:"Contract Department" category:Major level:Undergraduate classtype:Required semester:2026',
      },
      { credits: "2.5" },
      {
        teacher: "Same Name",
        courseCode: "course-1",
        search: "teacher:missing coursecode:missing",
        sort: "teacher",
        order: "desc",
      },
      { sort: "campus", order: "asc" },
      { sort: "campus", order: "desc" },
      { search: "credit:0 sort:capacity order:desc" },
    ]) {
      const pagination = { page: 1, pageSize: 20 };
      const legacy = await request(() =>
        listSectionSummaries({ filters, pagination }),
      );
      const table = await request(() =>
        listSectionTableSummaries({ filters, pagination }),
      );
      expect(table, JSON.stringify(filters)).toEqual(legacy);
    }
    const general = await request(() =>
      listSectionTableSummaries({
        filters: { search: "Contract Course", sort: "teacher", order: "desc" },
        pagination: { page: 1, pageSize: 2 },
      }),
    );
    expect(general.data.map((row) => row.id)).toEqual([
      fixture.sections[1].id,
      fixture.sections[0].id,
    ]);

    const teacherCountCases = await Promise.all(
      [0, 1, 2, 3].map((count) =>
        db.section.create({
          data: {
            jwId: fixture.base + 5 + count,
            code: `teacher-count-case-${count}`,
            courseId: fixture.courses[0].id,
            semesterId: fixture.semester.id,
            teachers: {
              connect: fixture.teachers
                .slice(0, Math.min(count, 2))
                .map((teacher) => ({
                  id: teacher.id,
                })),
            },
          },
        }),
      ),
    );
    const thirdTeacher = await db.teacher.create({
      data: {
        jwId: fixture.base + 10,
        nameCn: fixture.teachers[0].nameCn,
        nameEn: fixture.teachers[0].nameEn,
        code: "teacher-count-case-3",
        departmentId: fixture.departments[0].id,
      },
    });
    await db.section.update({
      where: { id: teacherCountCases[3].id },
      data: { teachers: { connect: { id: thirdTeacher.id } } },
    });

    const teacherCountComparisons = [
      ["eq", "1", undefined, [1]],
      ["ne", "1", undefined, [0, 2, 3]],
      ["gt", "1", undefined, [2, 3]],
      ["gte", "1", undefined, [1, 2, 3]],
      ["lt", "1", undefined, [0]],
      ["lte", "1", undefined, [0, 1]],
      ["between", "1", "2", [1, 2]],
    ] as const;
    for (const [op, threshold, max, indices] of teacherCountComparisons) {
      const result = await request(() =>
        listSectionTableSummaries({
          filters: {
            sectionCode: "teacher-count-case-",
            teacherCount: threshold,
            teacherCountOp: op,
            teacherCountMax: max,
          },
          pagination: { page: 1, pageSize: 20 },
        }),
      );
      expect(
        result.data.map((row) => row.id),
        `teacherCount ${op}`,
      ).toEqual(indices.map((index) => teacherCountCases[index].id));
      expect(result.pagination.total).toBe(indices.length);
    }
  });
});
