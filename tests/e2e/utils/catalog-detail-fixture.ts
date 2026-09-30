import type { Prisma } from "../../../src/generated/prisma-node/client";
import scenario from "../fixtures/scenario.json" with { type: "json" };
import {
  arrangeSearchCourse,
  arrangeSearchSection,
  arrangeSearchTeacher,
} from "./catalog-search-fixture";
import { test as preferenceTest } from "./personal-preferences-fixture";

/** One course, teacher and teaching section are the explicit public detail input. */
export async function arrangeDetailCatalog(db: Prisma.TransactionClient) {
  const course = await arrangeSearchCourse(db);
  const teacher = await arrangeSearchTeacher(db);
  const section = await arrangeSearchSection(db, course, teacher);
  return { ...course, ...teacher, ...section };
}

type DetailCatalog = Awaited<ReturnType<typeof arrangeDetailCatalog>>;

export const test = preferenceTest.extend<{ detailCatalog: DetailCatalog }>({
  detailCatalog: async ({ isolatedWorker, preferenceFlow }, use) => {
    await use(
      await preferenceFlow.prepare(() =>
        isolatedWorker.database.owner.$transaction(arrangeDetailCatalog),
      ),
    );
  },
});

/** Extra input requested only by the course introduction navigation/SSR cases. */
export async function arrangeCourseIntroduction(db: Prisma.TransactionClient) {
  const { index: _index, ...input } = scenario.courses[2];
  const course = await db.course.create({ data: input });
  await db.description.create({
    data: {
      courseId: course.id,
      content: "实验课建议准备护目镜并提前完成预习问答。",
    },
  });
}

/** Calendar/location and section metadata are independently authored known input. */
export async function arrangeSectionDetails(
  db: Prisma.TransactionClient,
  catalog: DetailCatalog,
) {
  const roomType = await db.roomType.create({
    data: scenario.catalog.roomType,
  });
  const examMode = await db.examMode.create({
    data: scenario.catalog.examMode,
  });
  const teachLanguage = await db.teachLanguage.create({
    data: scenario.catalog.teachLanguage,
  });
  const adminClass = await db.adminClass.create({
    data: scenario.catalog.adminClass,
  });
  const building = await db.building.create({
    data: { ...scenario.catalog.building, campusId: catalog.campus.id },
  });
  const room = await db.room.create({
    data: {
      ...scenario.catalog.room,
      buildingId: building.id,
      roomTypeId: roomType.id,
      floor: 1,
      virtual: false,
      seats: 60,
      seatsForSection: 60,
    },
  });
  await db.section.update({
    where: { id: catalog.section.id },
    data: {
      examModeId: examMode.id,
      teachLanguageId: teachLanguage.id,
      roomTypeId: roomType.id,
      adminClasses: { connect: { id: adminClass.id } },
    },
  });
  const group = await db.scheduleGroup.create({
    data: {
      jwId: scenario.scheduleGroups[0],
      sectionId: catalog.section.id,
      no: 1,
      limitCount: 80,
      stdCount: 58,
      actualPeriods: 2,
      isDefault: true,
    },
  });
  await db.schedule.create({
    data: {
      sectionId: catalog.section.id,
      scheduleGroupId: group.id,
      roomId: room.id,
      date: new Date("2026-04-29T00:00:00Z"),
      weekday: 3,
      startTime: 840,
      endTime: 1030,
      startUnit: 2,
      endUnit: 3,
      periods: 2,
      weekIndex: 2,
      teacherParticipations: {
        create: { teacherId: catalog.teacher.id, periods: 2 },
      },
    },
  });
  const examBatch = await db.examBatch.create({
    data: { jwId: 9910081, ...scenario.catalog.examBatch },
  });
  await db.exam.create({
    data: {
      jwId: scenario.exams[0].jwId,
      sectionId: catalog.section.id,
      examBatchId: examBatch.id,
      examDate: new Date("2026-05-09T00:00:00Z"),
      startTime: 900,
      endTime: 1100,
      examRooms: { create: { room: scenario.catalog.room.nameCn, count: 30 } },
    },
  });
}
