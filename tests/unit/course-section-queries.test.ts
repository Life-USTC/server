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

describe("course and section query helpers", () => {
  it("builds course filters from search and numeric ids", () => {
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

  it("drops invalid course numeric filters", () => {
    expect(
      buildCourseListWhere({
        educationLevelId: "foo",
        categoryId: "",
        classTypeId: null,
      }),
    ).toBeUndefined();
  });

  it("builds section filters, ids, and parsed search order", () => {
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

  it("builds advanced section search aliases", () => {
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

  it("ignores inexact section credit search values", () => {
    const result = buildSectionListQuery({
      search: "credits:3abc",
    });

    expect(result.where).toEqual({});
  });

  it("accepts numeric id arrays for section filters", () => {
    expect(
      buildSectionListQuery({
        ids: [7, 8, 9],
      }).where,
    ).toEqual({
      id: {
        in: [7, 8, 9],
      },
    });
  });

  it("builds JW-id-based course and semester filters", () => {
    const result = buildSectionListQuery({
      courseJwId: 101,
      semesterJwId: 202,
    });
    expect(result.where).toMatchObject({
      course: { jwId: 101 },
      semester: { jwId: 202 },
    });
  });

  it("builds teacherCode filter inside teachers.some", () => {
    const result = buildSectionListQuery({ teacherCode: "DEV-T-001" });
    expect(result.where).toMatchObject({
      teachers: { some: { code: "DEV-T-001" } },
    });
  });

  it("combines teacherId and teacherCode into a single teachers.some filter", () => {
    const result = buildSectionListQuery({
      teacherId: 55,
      teacherCode: "T-001",
    });
    expect(result.where).toMatchObject({
      teachers: { some: { id: 55, code: "T-001" } },
    });
  });

  it("builds jwIds filter on section.jwId", () => {
    const result = buildSectionListQuery({ jwIds: [9902001, 9902002] });
    expect(result.where).toMatchObject({
      jwId: { in: [9902001, 9902002] },
    });
  });

  it("parses comma-separated jwIds string", () => {
    const result = buildSectionListQuery({ jwIds: "9902001, 9902002, x" });
    expect(result.where).toMatchObject({
      jwId: { in: [9902001, 9902002] },
    });
  });

  it("trims whitespace from teacherCode and ignores empty string", () => {
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
