import type { Prisma } from "../../../src/generated/prisma-node/client";
import scenario from "../fixtures/scenario.json" with { type: "json" };
import { test as preferenceTest } from "./personal-preferences-fixture";

/** Explicit catalog input owned by the calling test, with no global seed reads. */
export async function arrangeSearchCourse(db: Prisma.TransactionClient) {
  const educationLevel = await db.educationLevel.create({
    data: scenario.catalog.educationLevel,
  });
  const category = await db.courseCategory.create({
    data: scenario.catalog.category,
  });
  const classType = await db.classType.create({
    data: scenario.catalog.classType,
  });
  const { index: _index, ...input } = scenario.courses[0];
  const course = await db.course.create({
    data: {
      ...input,
      educationLevelId: educationLevel.id,
      categoryId: category.id,
      classTypeId: classType.id,
    },
  });
  return { course, educationLevel, category, classType };
}

export async function arrangeSearchTeacher(db: Prisma.TransactionClient) {
  const department = await db.department.create({
    data: scenario.catalog.department,
  });
  const title = await db.teacherTitle.create({
    data: { ...scenario.catalog.teacherTitle, enabled: true },
  });
  const { index: _index, ...input } = scenario.teachers[0];
  const teacher = await db.teacher.create({
    data: { ...input, departmentId: department.id, teacherTitleId: title.id },
  });
  return { teacher, department };
}

type Course = Awaited<ReturnType<typeof arrangeSearchCourse>>;
type Teacher = Awaited<ReturnType<typeof arrangeSearchTeacher>>;

export async function arrangeSearchSection(
  db: Prisma.TransactionClient,
  course: Course,
  teacher: Teacher,
) {
  const semester = await db.semester.create({
    data: {
      ...scenario.semester,
      startDate: new Date("2026-04-08T00:00:00Z"),
      endDate: new Date(Date.now() + 180 * 86_400_000),
    },
  });
  const campus = await db.campus.create({ data: scenario.catalog.campus });
  const input = scenario.sections[0];
  const section = await db.section.create({
    data: {
      jwId: input.jwId,
      code: input.code,
      credits: input.credits,
      period: input.credits * 16,
      periodsPerWeek: 2,
      timesPerWeek: 2,
      stdCount: input.stdCount,
      limitCount: input.limitCount,
      remark: input.remark,
      courseId: course.course.id,
      semesterId: semester.id,
      campusId: campus.id,
      openDepartmentId: teacher.department.id,
      teachers: { connect: { id: teacher.teacher.id } },
      sectionTeachers: { create: { teacherId: teacher.teacher.id } },
    },
  });
  return { section, semester, campus };
}

/** Lazy fixtures: each consumer requests only the catalog it needs. */
export const test = preferenceTest.extend<{
  searchCourse: Course;
  searchTeacher: Teacher;
  searchSection: Awaited<ReturnType<typeof arrangeSearchSection>>;
}>({
  searchCourse: async ({ isolatedWorker, preferenceFlow }, use) => {
    await use(
      await preferenceFlow.prepare(() =>
        isolatedWorker.database.owner.$transaction(arrangeSearchCourse),
      ),
    );
  },
  searchTeacher: async ({ isolatedWorker, preferenceFlow }, use) => {
    await use(
      await preferenceFlow.prepare(() =>
        isolatedWorker.database.owner.$transaction(arrangeSearchTeacher),
      ),
    );
  },
  searchSection: async (
    { isolatedWorker, preferenceFlow, searchCourse, searchTeacher },
    use,
  ) => {
    await use(
      await preferenceFlow.prepare(() =>
        isolatedWorker.database.owner.$transaction((db) =>
          arrangeSearchSection(db, searchCourse, searchTeacher),
        ),
      ),
    );
  },
});
