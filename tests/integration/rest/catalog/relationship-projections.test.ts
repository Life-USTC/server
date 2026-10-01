import { expect } from "@playwright/test";
import { DEV_SEED } from "../../../e2e/utils/dev-seed";
import type { TestPrismaClient } from "../../../shared/prisma";
import { test } from "../_shared/catalog-reader-fixture";

test.use({ storageState: { cookies: [], origins: [] } });

async function readCatalogState(db: TestPrismaClient) {
  return {
    courses: await db.course.findMany({ orderBy: { id: "asc" } }),
    sections: await db.section.findMany({
      orderBy: { id: "asc" },
      include: {
        teachers: { orderBy: { id: "asc" }, select: { id: true } },
      },
    }),
    teachers: await db.teacher.findMany({ orderBy: { id: "asc" } }),
    campuses: await db.campus.findMany({ orderBy: { id: "asc" } }),
    buildings: await db.building.findMany({ orderBy: { id: "asc" } }),
    semesters: await db.semester.findMany({ orderBy: { id: "asc" } }),
    languages: await db.teachLanguage.findMany({ orderBy: { id: "asc" } }),
    classifications: await db.courseClassify.findMany({
      orderBy: { id: "asc" },
    }),
    assignments: await db.teacherAssignment.findMany({
      orderBy: { id: "asc" },
    }),
    groups: await db.scheduleGroup.findMany({ orderBy: { id: "asc" } }),
    schedules: await db.schedule.findMany({
      orderBy: { id: "asc" },
      include: {
        teacherParticipations: { orderBy: { teacherId: "asc" } },
      },
    }),
    exams: await db.exam.findMany({ orderBy: { id: "asc" } }),
    users: await db.user.findMany({ orderBy: { id: "asc" } }),
    sessions: await db.session.findMany({ orderBy: { id: "asc" } }),
    subscriptions: await db.userSectionSubscription.findMany({
      orderBy: [{ userId: "asc" }, { sectionId: "asc" }],
    }),
    audit: await db.auditLog.findMany({ orderBy: { id: "asc" } }),
  };
}

test("interface-hierarchy.catalog-rest-relationship-projections", async ({
  request,
  isolatedWorker,
  run,
}) => {
  await run(async () => {
    const db = isolatedWorker.database.owner;
    const before = await readCatalogState(db);
    expect(before.courses).toHaveLength(1);
    expect(before.sections).toHaveLength(1);
    expect(before.teachers).toHaveLength(1);
    expect(before.users).toEqual([]);
    expect(before.sessions).toEqual([]);
    expect(before.subscriptions).toEqual([]);
    expect(before.audit).toEqual([]);
    const course = await db.course.findUniqueOrThrow({
      where: { jwId: DEV_SEED.course.jwId },
    });
    const section = await db.section.findUniqueOrThrow({
      where: { jwId: DEV_SEED.section.jwId },
      include: { teachers: { select: { id: true } } },
    });
    const teacher = await db.teacher.findUniqueOrThrow({
      where: { jwId: DEV_SEED.teacher.jwId },
    });
    expect(course.id).not.toBe(course.jwId);
    expect(section.id).not.toBe(section.jwId);
    expect(teacher.id).not.toBe(teacher.jwId);
    expect(section.courseId).toBe(course.id);
    expect(section.teachers).toEqual([{ id: teacher.id }]);
    const courseIdentity = {
      id: course.id,
      jwId: course.jwId,
      code: course.code,
      nameCn: course.nameCn,
    };
    const sectionIdentity = {
      id: section.id,
      jwId: section.jwId,
      code: section.code,
      courseId: course.id,
    };
    const teacherIdentity = {
      id: teacher.id,
      jwId: teacher.jwId,
      code: teacher.code,
      nameCn: teacher.nameCn,
    };

    const courseList =
      await test.step("课程列表项包含所有必填字段", async () => {
        const response = await request.get(
          `/api/catalog/courses?search=${encodeURIComponent(DEV_SEED.course.code)}`,
        );
        expect(response.status()).toBe(200);
        const body = (await response.json()) as {
          data?: Array<{
            id?: unknown;
            jwId?: unknown;
            code?: unknown;
            nameCn?: unknown;
            nameEn?: unknown;
            educationLevel?: unknown;
            category?: unknown;
            classType?: unknown;
          }>;
        };
        const course = body.data?.find(
          (item) => item.jwId === DEV_SEED.course.jwId,
        );
        expect(course).toBeDefined();
        expect(typeof course?.id).toBe("number");
        expect(typeof course?.jwId).toBe("number");
        expect(typeof course?.code).toBe("string");
        expect(typeof course?.nameCn).toBe("string");
        expect(typeof course?.nameEn).toBe("string");
        expect(Object.hasOwn(course as object, "educationLevel")).toBe(true);
        expect(Object.hasOwn(course as object, "category")).toBe(true);
        expect(Object.hasOwn(course as object, "classType")).toBe(true);

        expect(course).toMatchObject(courseIdentity);
        expect(await readCatalogState(db)).toEqual(before);
        return course;
      });

    const teacherList =
      await test.step("教师列表项包含所有必需的 TeacherSummary 字段", async () => {
        const response = await request.get(
          `/api/catalog/teachers?search=${encodeURIComponent(DEV_SEED.teacher.code)}&pageSize=5`,
        );
        expect(response.status()).toBe(200);
        const body = (await response.json()) as {
          data?: Array<{
            id?: unknown;
            nameCn?: unknown;
            code?: unknown;
            _count?: { sections?: unknown };
            department?: unknown;
            teacherTitle?: unknown;
          }>;
        };
        const teacher = body.data?.find(
          (item) => (item.code as string | null) === DEV_SEED.teacher.code,
        );
        expect(teacher).toBeDefined();
        expect(typeof teacher?.id).toBe("number");
        expect(typeof teacher?.nameCn).toBe("string");
        expect(Object.hasOwn(teacher as object, "code")).toBe(true);
        expect(typeof teacher?._count?.sections).toBe("number");
        expect((teacher?._count?.sections as number) >= 0).toBe(true);
        expect(Object.hasOwn(teacher as object, "department")).toBe(true);
        expect(Object.hasOwn(teacher as object, "teacherTitle")).toBe(true);

        expect(teacher).toMatchObject(teacherIdentity);
        expect(teacher?._count?.sections).toBe(1);
        expect(await readCatalogState(db)).toEqual(before);
        return teacher;
      });

    const sectionList =
      await test.step("班级列表项包含所有必需的 SectionSummary 字段", async () => {
        const response = await request.get(
          `/api/catalog/sections?search=${encodeURIComponent(DEV_SEED.section.code)}&pageSize=20`,
        );
        expect(response.status()).toBe(200);
        const body = (await response.json()) as {
          data?: Array<{
            id?: unknown;
            jwId?: unknown;
            code?: unknown;
            course?: { nameCn?: unknown; nameEn?: unknown };
            semester?: { nameCn?: string } | null;
            credits?: unknown;
            stdCount?: unknown;
            limitCount?: unknown;
          }>;
        };
        const section = body.data?.find(
          (item) => item.jwId === DEV_SEED.section.jwId,
        );
        expect(section).toBeDefined();
        expect(typeof section?.id).toBe("number");
        expect(typeof section?.jwId).toBe("number");
        expect(typeof section?.code).toBe("string");
        expect(typeof section?.course?.nameCn).toBe("string");
        expect(Object.hasOwn(section?.course as object, "nameEn")).toBe(true);
        expect(Object.hasOwn(section as object, "semester")).toBe(true);
        expect(Object.hasOwn(section as object, "credits")).toBe(true);
        expect(typeof section?.stdCount).toBe("number");
        expect(typeof section?.limitCount).toBe("number");

        expect(section).toMatchObject({
          ...sectionIdentity,
          course: courseIdentity,
        });
        expect(section?.course).toMatchObject({ id: courseList?.id });
        expect(await readCatalogState(db)).toEqual(before);
        return section;
      });

    await test.step("班级列表项包含教师数组", async () => {
      const response = await request.get(
        `/api/catalog/sections?search=${encodeURIComponent(DEV_SEED.section.code)}&pageSize=20`,
      );
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        data?: Array<{ jwId?: number; teachers?: unknown[] }>;
      };
      const section = body.data?.find(
        (item) => item.jwId === DEV_SEED.section.jwId,
      );
      expect(section).toBeDefined();
      expect(Array.isArray(section?.teachers)).toBe(true);

      expect(section?.teachers).toEqual([
        expect.objectContaining(teacherIdentity),
      ]);
      expect(section).toMatchObject({ jwId: sectionList?.jwId });
      expect(await readCatalogState(db)).toEqual(before);
    });

    await test.step("详情路由返回 seed 课程及其开课班", async () => {
      const response = await request.get(
        `/api/catalog/courses/${DEV_SEED.course.jwId}`,
      );
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        jwId?: number;
        code?: string;
        nameCn?: string;
        _count?: { sections?: number };
        sections?: Array<{
          jwId?: number;
          code?: string;
          semester?: { nameCn?: string } | null;
          campus?: { nameCn?: string } | null;
          teachers?: unknown[];
          stdCount?: unknown;
          limitCount?: unknown;
        }>;
      };
      expect(body.jwId).toBe(DEV_SEED.course.jwId);
      expect(body.code).toBe(DEV_SEED.course.code);
      expect(body.nameCn).toBe(DEV_SEED.course.nameCn);
      expect(body.sections?.length ?? 0).toBeLessThanOrEqual(20);
      expect(body._count?.sections ?? 0).toBeGreaterThanOrEqual(
        body.sections?.length ?? 0,
      );
      expect(
        body.sections?.some(
          (section) => section.jwId === DEV_SEED.section.jwId,
        ),
      ).toBe(true);
      const seedSection = body.sections?.find(
        (s) => s.jwId === DEV_SEED.section.jwId,
      );
      expect(seedSection).toBeDefined();
      expect(Object.hasOwn(seedSection as object, "semester")).toBe(true);
      expect(Object.hasOwn(seedSection as object, "campus")).toBe(true);
      expect(Array.isArray(seedSection?.teachers)).toBe(true);
      for (const teacher of seedSection?.teachers ?? []) {
        expect(teacher).not.toHaveProperty("age");
        expect(teacher).not.toHaveProperty("postcode");
        expect(teacher).not.toHaveProperty("qq");
        expect(teacher).not.toHaveProperty("wechat");
        expect(teacher).not.toHaveProperty("email");
        expect(teacher).not.toHaveProperty("mobile");
      }
      expect(typeof seedSection?.stdCount).toBe("number");
      expect(typeof seedSection?.limitCount).toBe("number");

      expect(body).toMatchObject(courseIdentity);
      expect(body._count?.sections).toBe(1);
      expect(seedSection).toMatchObject({
        ...sectionIdentity,
        teachers: [expect.objectContaining(teacherIdentity)],
      });
      expect(seedSection?.jwId).toBe(sectionList?.jwId);
      expect(await readCatalogState(db)).toEqual(before);
    });

    await test.step("详情路由返回带班级的 seed 教师", async () => {
      const cacheBust = `teacher-detail-${Date.now()}`;
      const teacherListResponse = await request.get(
        `/api/catalog/teachers?search=${encodeURIComponent(DEV_SEED.teacher.code)}&pageSize=5&cacheBust=${cacheBust}`,
      );
      expect(teacherListResponse.status()).toBe(200);
      const teacherListBody = (await teacherListResponse.json()) as {
        data?: Array<{ id?: number; code?: string | null }>;
      };
      const teacherId = teacherListBody.data?.find(
        (item) => item.code === DEV_SEED.teacher.code,
      )?.id;
      expect(teacherId).toBeDefined();

      const response = await request.get(`/api/catalog/teachers/${teacherId}`);
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        id?: number;
        code?: string | null;
        nameCn?: string;
        nameEn?: unknown;
        telephone?: unknown;
        mobile?: unknown;
        address?: unknown;
        sections?: Array<{
          code?: string;
          course?: { nameCn?: unknown };
          semester?: unknown;
          credits?: unknown;
        }>;
        _count?: { sections?: number };
      };
      expect(body.id).toBe(teacherId);
      expect(body.code).toBe(DEV_SEED.teacher.code);
      expect(body.nameCn).toBe(DEV_SEED.teacher.nameCn);
      expect(
        body.sections?.some(
          (section) => section.code === DEV_SEED.section.code,
        ),
      ).toBe(true);
      expect((body._count?.sections ?? 0) > 0).toBe(true);
      expect(body.sections?.length ?? 0).toBeLessThanOrEqual(20);
      expect(body._count?.sections ?? 0).toBeGreaterThanOrEqual(
        body.sections?.length ?? 0,
      );
      expect(body).not.toHaveProperty("age");
      expect(body).not.toHaveProperty("postcode");
      expect(body).not.toHaveProperty("qq");
      expect(body).not.toHaveProperty("wechat");
      expect(Object.hasOwn(body, "nameEn")).toBe(true);
      expect(Object.hasOwn(body, "telephone")).toBe(true);
      expect(Object.hasOwn(body, "mobile")).toBe(true);
      expect(Object.hasOwn(body, "address")).toBe(true);
      const seedSection = body.sections?.find(
        (s) => s.code === DEV_SEED.section.code,
      );
      expect(seedSection).toBeDefined();
      expect(typeof seedSection?.course?.nameCn).toBe("string");
      expect(Object.hasOwn(seedSection as object, "semester")).toBe(true);
      expect(Object.hasOwn(seedSection as object, "credits")).toBe(true);

      expect(body).toMatchObject(teacherIdentity);
      expect(body.id).toBe(teacherList?.id);
      expect(body._count?.sections).toBe(1);
      expect(seedSection).toMatchObject({
        ...sectionIdentity,
        course: courseIdentity,
      });
      expect(seedSection?.code).toBe(sectionList?.code);
      expect(await readCatalogState(db)).toEqual(before);
    });
  });
});
