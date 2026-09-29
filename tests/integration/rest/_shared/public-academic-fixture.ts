import type { IsolatedWorker } from "../../../e2e/utils/isolated-worker";
import { test as workerTest } from "../../../e2e/utils/owned-worker";

async function prepareAcademic(worker: IsolatedWorker) {
  // The semester must contain the Worker's actual clock, including a Shanghai
  // midnight crossed during startup. The filter date itself stays case-owned.
  const dayMs = 24 * 60 * 60 * 1000;
  const capturedDay = new Date().toISOString().slice(0, 10);
  const anchor = new Date(`${capturedDay}T00:00:00Z`).getTime();
  const dateAt = (offset: number) => new Date(anchor + offset * dayMs);
  return worker.database.owner.$transaction(async (db) => {
    await db.semester.create({
      data: {
        jwId: 1_820_000_000,
        code: "PRIVATE-PAST",
        nameCn: "独立历史学期",
        startDate: dateAt(-120),
        endDate: dateAt(-60),
      },
    });
    const semester = await db.semester.create({
      data: {
        jwId: 1_820_000_001,
        code: "PRIVATE-CURRENT",
        nameCn: "独立当前学期",
        startDate: dateAt(-30),
        endDate: dateAt(30),
      },
    });
    await db.semester.create({
      data: {
        jwId: 1_820_000_002,
        code: "PRIVATE-FUTURE",
        nameCn: "独立未来学期",
        startDate: dateAt(60),
        endDate: dateAt(120),
      },
    });
    const course = await db.course.create({
      data: {
        jwId: 1_820_000_000,
        code: "PRIVATE-ACADEMIC",
        nameCn: "独立公共课程",
      },
    });
    const teacher = await db.teacher.create({
      data: {
        jwId: 1_820_000_000,
        personId: 1_820_000_010,
        code: "PRIVATE-TEACHER",
        nameCn: "独立排课教师",
      },
    });
    const section = await db.section.create({
      data: {
        jwId: 1_820_000_000,
        code: "PRIVATE-ACADEMIC-01",
        courseId: course.id,
        semesterId: semester.id,
        teachers: { connect: { id: teacher.id } },
      },
    });
    const otherSection = await db.section.create({
      data: {
        jwId: 1_820_000_001,
        code: "PRIVATE-ACADEMIC-02",
        courseId: course.id,
        semesterId: semester.id,
      },
    });
    // The default group must win over both insertion order and group number.
    const otherGroup = await db.scheduleGroup.create({
      data: {
        jwId: 1_820_000_000,
        sectionId: section.id,
        no: 1,
        limitCount: 20,
        stdCount: 1,
        actualPeriods: 2,
        isDefault: false,
      },
    });
    const defaultGroup = await db.scheduleGroup.create({
      data: {
        jwId: 1_820_000_001,
        sectionId: section.id,
        no: 2,
        limitCount: 20,
        stdCount: 1,
        actualPeriods: 6,
        isDefault: true,
      },
    });
    const unrelatedGroup = await db.scheduleGroup.create({
      data: {
        jwId: 1_820_000_002,
        sectionId: otherSection.id,
        no: 1,
        limitCount: 20,
        stdCount: 1,
        actualPeriods: 2,
        isDefault: true,
      },
    });
    const schedules = [];
    // Insert days and same-day times out of order, with rows on both sides of
    // the filter date. Missing either date bound or sort key must be observable.
    for (const entry of [
      { offset: 1, hour: 9, groupId: defaultGroup.id },
      { offset: 0, hour: 14, groupId: otherGroup.id },
      { offset: 0, hour: 9, groupId: defaultGroup.id },
      { offset: -1, hour: 9, groupId: defaultGroup.id },
    ]) {
      schedules.push(
        await db.schedule.create({
          data: {
            sectionId: section.id,
            scheduleGroupId: entry.groupId,
            date: dateAt(entry.offset),
            weekday: dateAt(entry.offset).getUTCDay() || 7,
            startTime: entry.hour * 100,
            endTime: (entry.hour + 1) * 100,
            periods: 2,
            weekIndex: 5,
            startUnit: 1,
            endUnit: 2,
            teacherParticipations: {
              create: {
                teacherId: teacher.id,
                periods: 2,
                exerciseClass: false,
              },
            },
          },
        }),
      );
    }
    await db.schedule.create({
      data: {
        sectionId: otherSection.id,
        scheduleGroupId: unrelatedGroup.id,
        date: dateAt(0),
        weekday: dateAt(0).getUTCDay() || 7,
        startTime: 800,
        endTime: 900,
        periods: 2,
        weekIndex: 5,
        startUnit: 1,
        endUnit: 2,
      },
    });
    return {
      semester,
      section,
      teacher,
      defaultGroup,
      otherGroup,
      schedules,
      date: capturedDay,
    };
  });
}

type Academic = Awaited<ReturnType<typeof prepareAcademic>>;

// The owned workflow drains setup and complete HTTP/body observations before
// Playwright disposes this case's request context, Worker and database.
export const test = workerTest.extend<{ academic: Academic }>({
  academic: async ({ isolatedWorker, run }, use) => {
    const academic = await run(() => prepareAcademic(isolatedWorker));
    await use(academic);
  },
});
