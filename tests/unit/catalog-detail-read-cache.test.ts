import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetPublicRuntimeCacheForTest } from "@/lib/public-runtime-cache";

const {
  courseFindManyMock,
  courseFindUniqueMock,
  getCatalogDetailCacheRevisionMock,
  sectionFindUniqueMock,
  teacherFindManyMock,
  teacherFindUniqueMock,
} = vi.hoisted(() => ({
  courseFindManyMock: vi.fn(),
  courseFindUniqueMock: vi.fn(),
  getCatalogDetailCacheRevisionMock: vi.fn(async () => "revision-a"),
  sectionFindUniqueMock: vi.fn(),
  teacherFindManyMock: vi.fn(),
  teacherFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/catalog-detail-cache-revision", () => ({
  getCatalogDetailCacheRevision: getCatalogDetailCacheRevisionMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: vi.fn(() => ({
    course: { findMany: courseFindManyMock, findUnique: courseFindUniqueMock },
    section: { findMany: vi.fn(), findUnique: sectionFindUniqueMock },
    teacher: {
      findMany: teacherFindManyMock,
      findUnique: teacherFindUniqueMock,
    },
  })),
}));

describe("shared public catalog detail cache", () => {
  beforeEach(() => {
    resetPublicRuntimeCacheForTest();
    courseFindManyMock.mockReset();
    courseFindUniqueMock.mockReset();
    sectionFindUniqueMock.mockReset();
    teacherFindManyMock.mockReset();
    teacherFindUniqueMock.mockReset();
    getCatalogDetailCacheRevisionMock.mockReset();
    getCatalogDetailCacheRevisionMock.mockResolvedValue("revision-a");
  });

  it("shares course and teacher detail hits with single-id GraphQL batches", async () => {
    const course = {
      id: 1,
      jwId: 101,
      code: "COURSE-1",
      nameCn: "课程 1",
      nameEn: null,
      categoryId: null,
      classTypeId: null,
      classifyId: null,
      educationLevelId: null,
      gradationId: null,
      typeId: null,
      category: null,
      classType: null,
      classify: null,
      educationLevel: null,
      gradation: null,
      type: null,
      sections: [],
      _count: { sections: 0 },
    };
    const teacher = {
      id: 2,
      jwId: 202,
      personId: null,
      code: "T-2",
      nameCn: "教师",
      nameEn: "Teacher",
      email: null,
      telephone: null,
      mobile: null,
      address: null,
      departmentId: null,
      teacherTitleId: null,
      department: null,
      teacherTitle: null,
      sections: [],
      _count: { sections: 0 },
    };
    courseFindUniqueMock.mockResolvedValue(course);
    courseFindManyMock.mockResolvedValue([course]);
    teacherFindUniqueMock.mockResolvedValue(teacher);
    teacherFindManyMock.mockResolvedValue([teacher]);
    const { findCourseDetailByJwId, findCoursesByJwIds } = await import(
      "@/features/catalog/server/course-section-read-queries"
    );
    const { findTeacherDetailById, findTeachersByIds } = await import(
      "@/features/catalog/server/teacher-summary-read-model"
    );

    await expect(findCourseDetailByJwId(101, "zh-cn")).resolves.toMatchObject({
      id: 1,
      jwId: 101,
    });
    await expect(findCoursesByJwIds([101], "zh-cn")).resolves.toEqual([course]);
    await expect(findTeacherDetailById(2, "zh-cn")).resolves.toMatchObject({
      id: 2,
      jwId: 202,
      namePrimary: "教师",
    });
    await expect(findTeachersByIds([2], "zh-cn")).resolves.toEqual([teacher]);

    expect(courseFindUniqueMock).toHaveBeenCalledOnce();
    expect(courseFindManyMock).toHaveBeenCalledOnce();
    expect(teacherFindUniqueMock).toHaveBeenCalledOnce();
    expect(teacherFindManyMock).toHaveBeenCalledOnce();
  });

  it("isolates section details by locale and requested child shape", async () => {
    sectionFindUniqueMock.mockResolvedValue({
      exams: [],
      id: 3,
      scheduleGroups: [],
      schedules: [],
      teacherAssignments: [],
      teachers: [],
    });
    const { findSectionDetailByJwId } = await import(
      "@/features/catalog/server/course-section-read-queries"
    );

    await findSectionDetailByJwId(303, "zh-cn", {
      includeExams: false,
      includeSchedules: false,
      includeTeacherDepartments: false,
    });
    await findSectionDetailByJwId(303, "zh-cn", {
      includeExams: false,
      includeSchedules: false,
      includeTeacherDepartments: false,
    });
    await findSectionDetailByJwId(303, "zh-cn", {
      includeExams: true,
      includeSchedules: false,
      includeTeacherDepartments: false,
    });
    await findSectionDetailByJwId(303, "en-us", {
      includeExams: false,
      includeSchedules: false,
      includeTeacherDepartments: false,
    });

    expect(sectionFindUniqueMock).toHaveBeenCalledTimes(3);
  });

  it("isolates runtime entries by static import revision", async () => {
    courseFindUniqueMock.mockResolvedValue({
      id: 1,
      jwId: 101,
      code: "COURSE-1",
      nameCn: "课程 1",
      nameEn: null,
      categoryId: null,
      classTypeId: null,
      classifyId: null,
      educationLevelId: null,
      gradationId: null,
      typeId: null,
      category: null,
      classType: null,
      classify: null,
      educationLevel: null,
      gradation: null,
      type: null,
      sections: [],
      _count: { sections: 0 },
    });
    const { findCourseDetailByJwId } = await import(
      "@/features/catalog/server/course-section-read-queries"
    );

    await findCourseDetailByJwId(101, "zh-cn");
    getCatalogDetailCacheRevisionMock.mockResolvedValue("revision-b");
    await findCourseDetailByJwId(101, "zh-cn");

    expect(courseFindUniqueMock).toHaveBeenCalledTimes(2);
  });

  it("does not retain missing detail results", async () => {
    teacherFindUniqueMock.mockResolvedValue(null);
    const { findTeacherDetailById } = await import(
      "@/features/catalog/server/teacher-summary-read-model"
    );

    await expect(findTeacherDetailById(404, "zh-cn")).resolves.toBeNull();
    await expect(findTeacherDetailById(404, "zh-cn")).resolves.toBeNull();

    expect(teacherFindUniqueMock).toHaveBeenCalledTimes(2);
  });
});
