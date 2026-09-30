import type { IsolatedWorker } from "../../../e2e/utils/isolated-worker";
import { test as workerTest } from "../../../e2e/utils/owned-worker";
import { DEV_SEED, DEV_SEED_ANCHOR } from "../../../fixtures/dev-seed";

async function prepareCatalog(worker: IsolatedWorker) {
  // These contracts keep their explicit scenario identities, but each test
  // creates only the catalog graph it reads inside its own empty database.
  await worker.database.owner.$transaction(async (db) => {
    const campus = await db.campus.create({
      data: {
        jwId: 9910001,
        code: "EAST",
        ...DEV_SEED.campus,
      },
    });
    await db.building.create({
      data: {
        jwId: 9910021,
        code: "BLDG-1",
        ...DEV_SEED.building,
        campusId: campus.id,
      },
    });
    const teachLanguage = await db.teachLanguage.create({
      data: {
        nameCn: DEV_SEED.section.teachLanguageNameCn,
        nameEn: DEV_SEED.section.teachLanguageNameEn,
      },
    });
    const classify = await db.courseClassify.create({
      data: { nameCn: DEV_SEED.metadata.courseClassifyNameCn },
    });
    const semester = await db.semester.create({
      data: {
        jwId: DEV_SEED.semesterJwId,
        code: "421",
        nameCn: DEV_SEED.semesterNameCn,
        startDate: new Date("2026-04-01T00:00:00Z"),
        // Match-code contracts select the current semester using the Worker clock.
        endDate: new Date(Date.now() + 180 * 86_400_000),
      },
    });
    const course = await db.course.create({
      data: {
        jwId: DEV_SEED.course.jwId,
        code: DEV_SEED.course.code,
        nameCn: DEV_SEED.course.nameCn,
        nameEn: DEV_SEED.course.nameEn,
        classifyId: classify.id,
      },
    });
    const teacher = await db.teacher.create({
      data: {
        jwId: DEV_SEED.teacher.jwId,
        code: DEV_SEED.teacher.code,
        nameCn: DEV_SEED.teacher.nameCn,
        nameEn: DEV_SEED.teacher.nameEn,
        email: DEV_SEED.teacher.email,
      },
    });
    const section = await db.section.create({
      data: {
        jwId: DEV_SEED.section.jwId,
        code: DEV_SEED.section.code,
        credits: DEV_SEED.section.credits,
        stdCount: DEV_SEED.section.stdCount,
        limitCount: DEV_SEED.section.limitCount,
        courseId: course.id,
        semesterId: semester.id,
        campusId: campus.id,
        teachLanguageId: teachLanguage.id,
        teachers: { connect: { id: teacher.id } },
      },
    });
    await db.teacherAssignment.create({
      data: {
        teacherId: teacher.id,
        sectionId: section.id,
        role: "主讲",
        period: 2,
      },
    });
    const group = await db.scheduleGroup.create({
      data: {
        jwId: 9903001,
        sectionId: section.id,
        no: 1,
        limitCount: DEV_SEED.section.limitCount,
        stdCount: DEV_SEED.section.stdCount,
        actualPeriods: 2,
        isDefault: true,
      },
    });
    await db.schedule.create({
      data: {
        sectionId: section.id,
        scheduleGroupId: group.id,
        date: new Date(`${DEV_SEED_ANCHOR.date}T00:00:00Z`),
        weekday: 3,
        startTime: 800,
        endTime: 935,
        periods: 2,
        weekIndex: 5,
        startUnit: 1,
        endUnit: 2,
        teacherParticipations: { create: { teacherId: teacher.id } },
      },
    });
    await db.exam.create({
      data: {
        jwId: 9904001,
        sectionId: section.id,
        examDate: new Date("2026-06-20T00:00:00Z"),
        startTime: 1400,
        endTime: 1600,
      },
    });
  });
}

export const test = workerTest.extend<{ _catalog: undefined }>({
  _catalog: [
    async ({ isolatedWorker, run }, use) => {
      await run(() => prepareCatalog(isolatedWorker));
      await use(undefined);
    },
    { auto: true },
  ],
});
