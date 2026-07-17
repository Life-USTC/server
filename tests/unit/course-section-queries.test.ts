import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({}),
  prisma: {
    semester: {},
    section: {},
    user: {},
  },
}));

let buildCourseListWhere: typeof import("@/features/catalog/server/course-section-queries").buildCourseListWhere;
let buildSectionListQuery: typeof import("@/features/catalog/server/course-section-queries").buildSectionListQuery;

beforeAll(async () => {
  const queries = await import(
    "@/features/catalog/server/course-section-queries"
  );
  buildCourseListWhere = queries.buildCourseListWhere;
  buildSectionListQuery = queries.buildSectionListQuery;
});

describe("课程与开课查询辅助函数", () => {
  it("根据搜索和数字 ID 构建课程筛选条件", () => {
    expect(
      buildCourseListWhere({
        search: "math",
        educationLevelId: "1",
        categoryId: "2",
        classTypeId: 3,
      }),
    ).toEqual({
      OR: [
        { nameCn: { contains: "math", mode: "insensitive" } },
        { nameEn: { contains: "math", mode: "insensitive" } },
        { code: { contains: "math", mode: "insensitive" } },
      ],
      educationLevelId: 1,
      categoryId: 2,
      classTypeId: 3,
    });
  });

  it("丢弃无效的课程数字筛选条件", () => {
    expect(
      buildCourseListWhere({
        educationLevelId: "foo",
        categoryId: "",
        classTypeId: null,
      }),
    ).toBeUndefined();
  });

  it("构建开课筛选条件、ID 和解析后的搜索排序", () => {
    const result = buildSectionListQuery({
      courseId: "11",
      semesterId: 22,
      campusId: "33",
      departmentId: "44",
      teacherId: "55",
      ids: "1, 2, x, 3",
      search: "teacher:smith sort:semester order:desc linear algebra",
    });

    expect(result.where).toMatchObject({
      retiredAt: null,
      courseId: 11,
      semesterId: 22,
      campusId: 33,
      openDepartmentId: 44,
      teachers: {
        some: {
          id: 55,
        },
      },
      id: { in: [1, 2, 3] },
    });
    expect(result.where.AND).toEqual(
      expect.arrayContaining([
        {
          teachers: {
            some: {
              nameCn: {
                contains: "smith",
                mode: "insensitive",
              },
            },
          },
        },
        {
          OR: [
            {
              course: {
                nameCn: {
                  contains: "linear algebra",
                  mode: "insensitive",
                },
              },
            },
            {
              course: {
                nameEn: {
                  contains: "linear algebra",
                  mode: "insensitive",
                },
              },
            },
            {
              course: {
                code: {
                  contains: "linear algebra",
                  mode: "insensitive",
                },
              },
            },
            {
              code: {
                contains: "linear algebra",
                mode: "insensitive",
              },
            },
          ],
        },
      ]),
    );
    expect(result.orderBy).toEqual({ semester: { jwId: "desc" } });
  });

  it("构建高级开课搜索别名", () => {
    const result = buildSectionListQuery({
      search:
        "coursecode:MATH sectioncode:SEC campus:west credit:3.5 dept:CS semester:fall category:core edulevel:ug type:lab sortby:campus order:DESC leftover",
    });

    expect(result.where.AND).toEqual(
      expect.arrayContaining([
        {
          course: {
            code: {
              contains: "MATH",
              mode: "insensitive",
            },
          },
        },
        {
          code: {
            contains: "SEC",
            mode: "insensitive",
          },
        },
        {
          campus: {
            nameCn: {
              contains: "west",
              mode: "insensitive",
            },
          },
        },
        { credits: 3.5 },
        {
          openDepartment: {
            nameCn: {
              contains: "CS",
              mode: "insensitive",
            },
          },
        },
        {
          course: {
            educationLevel: {
              nameCn: {
                contains: "ug",
                mode: "insensitive",
              },
            },
          },
        },
        {
          course: {
            classType: {
              nameCn: {
                contains: "lab",
                mode: "insensitive",
              },
            },
          },
        },
        {
          OR: expect.arrayContaining([
            {
              course: {
                nameCn: {
                  contains: "leftover",
                  mode: "insensitive",
                },
              },
            },
          ]),
        },
      ]),
    );
    expect(result.orderBy).toEqual({ campus: { nameCn: "desc" } });
  });

  it("忽略不精确的开课学分搜索值", () => {
    const result = buildSectionListQuery({
      search: "credits:3abc",
    });

    expect(result.where).toEqual({ retiredAt: null });
  });

  it("接受数字 ID 数组作为开课筛选条件", () => {
    expect(
      buildSectionListQuery({
        ids: [7, 8, 9],
      }).where,
    ).toEqual({
      retiredAt: null,
      id: {
        in: [7, 8, 9],
      },
    });
  });

  it("根据 JW ID 构建学期筛选条件", () => {
    const result = buildSectionListQuery({
      courseJwId: 101,
      semesterJwId: 202,
    });
    expect(result.where).toMatchObject({
      retiredAt: null,
      semester: { jwId: 202 },
    });
    expect(result.where).not.toHaveProperty("course");
  });

  it("在 teachers.some 内构建 teacherCode 筛选条件", () => {
    const result = buildSectionListQuery({ teacherCode: "DEV-T-001" });
    expect(result.where).toMatchObject({
      teachers: { some: { code: "DEV-T-001" } },
    });
  });

  it("将 teacherId 和 teacherCode 合并为单个 teachers.some 筛选条件", () => {
    const result = buildSectionListQuery({
      teacherId: 55,
      teacherCode: "T-001",
    });
    expect(result.where).toMatchObject({
      teachers: { some: { id: 55, code: "T-001" } },
    });
  });

  it("在 section.jwId 上构建 jwIds 筛选条件", () => {
    const result = buildSectionListQuery({ jwIds: [9902001, 9902002] });
    expect(result.where).toMatchObject({
      jwId: { in: [9902001, 9902002] },
    });
  });

  it("解析逗号分隔的 jwIds 字符串", () => {
    const result = buildSectionListQuery({ jwIds: "9902001, 9902002, x" });
    expect(result.where).toMatchObject({
      jwId: { in: [9902001, 9902002] },
    });
  });

  it("去除 teacherCode 首尾空白并忽略空字符串", () => {
    expect(
      buildSectionListQuery({ teacherCode: "  " }).where,
    ).not.toHaveProperty("teachers");
    expect(
      buildSectionListQuery({ teacherCode: "  T-001  " }).where,
    ).toMatchObject({
      teachers: { some: { code: "T-001" } },
    });
  });
});
