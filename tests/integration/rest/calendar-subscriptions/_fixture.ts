import type { IsolatedWorker } from "../../../e2e/utils/isolated-worker";
import { test as workerTest } from "../../../e2e/utils/owned-worker";

export const calendarCatalog = {
  courseNameCn: "独立订阅课程",
  teacher: {
    jwId: 1_800_000_000,
    nameCn: "独立教师",
    nameEn: "Private Teacher",
    departmentNameCn: "独立院系",
    titleNameCn: "独立职称",
  },
};

async function prepareCalendar(worker: IsolatedWorker, assertOpen: () => void) {
  const db = worker.database.owner;
  const owner = await worker.createActor();
  assertOpen();
  const other = await worker.createActor();
  assertOpen();
  const domain = await db.$transaction(async (tx) => {
    assertOpen();
    const course = await tx.course.create({
      data: {
        jwId: 1_800_000_000,
        code: "PRIVATE-CALENDAR",
        nameCn: calendarCatalog.courseNameCn,
        nameEn: "Private subscription course",
      },
    });
    const department = await tx.department.create({
      data: {
        jwId: 1_800_000_000,
        code: "PRIVATE-DEPARTMENT",
        nameCn: calendarCatalog.teacher.departmentNameCn,
      },
    });
    const title = await tx.teacherTitle.create({
      data: {
        jwId: 1_800_000_000,
        code: "PRIVATE-TITLE",
        nameCn: calendarCatalog.teacher.titleNameCn,
      },
    });
    const teacher = await tx.teacher.create({
      data: {
        jwId: calendarCatalog.teacher.jwId,
        nameCn: calendarCatalog.teacher.nameCn,
        nameEn: calendarCatalog.teacher.nameEn,
        departmentId: department.id,
        teacherTitleId: title.id,
      },
    });
    const semesters = [];
    for (const [index, term] of [
      {
        code: "2026-spring",
        nameCn: "2026年春季学期",
        start: "2026-02-01",
        end: "2026-07-01",
      },
      {
        code: "2025-fall",
        nameCn: "2025年秋季学期",
        start: "2025-09-01",
        end: "2026-01-31",
      },
    ].entries()) {
      semesters.push(
        await tx.semester.create({
          data: {
            jwId: 1_800_000_000 + index,
            code: term.code,
            nameCn: term.nameCn,
            startDate: new Date(term.start),
            endDate: new Date(term.end),
          },
        }),
      );
    }
    const sections = [];
    for (const index of [0, 1, 2]) {
      sections.push(
        await tx.section.create({
          data: {
            jwId: 1_800_000_000 + index,
            code: `PRIVATE-CALENDAR-${index}`,
            courseId: course.id,
            teachers: { connect: { id: teacher.id } },
            semesterId: semesters[index === 2 ? 1 : 0].id,
          },
        }),
      );
    }
    const group = await tx.scheduleGroup.create({
      data: {
        sectionId: sections[0].id,
        jwId: sections[0].jwId,
        no: 1,
        limitCount: 10,
        stdCount: 0,
        actualPeriods: 2,
        isDefault: true,
      },
    });
    assertOpen();
    return { sections, scheduleGroupId: group.id, teacherId: teacher.id };
  });
  const [section, second, previous] = domain.sections;
  return {
    db,
    owner,
    other,
    section,
    second,
    previous,
    scheduleGroupId: domain.scheduleGroupId,
    teacherId: domain.teacherId,
  };
}

type CalendarState = Awaited<ReturnType<typeof prepareCalendar>>;
export const test = workerTest.extend<{
  createActor: IsolatedWorker["createActor"];
  _calendarSetup: { prepare: () => Promise<CalendarState> };
  calendarState: CalendarState;
}>({
  createActor: async ({ isolatedWorker, run }, use) => {
    await use((options) => run(() => isolatedWorker.createActor(options)));
  },
  _calendarSetup: async ({ isolatedWorker, run }, use) => {
    let closing = false;
    const assertOpen = () => {
      if (closing) throw new Error("Calendar setup is closing");
    };
    try {
      await use({
        prepare: () =>
          run(() => {
            assertOpen();
            return prepareCalendar(isolatedWorker, assertOpen);
          }),
      });
    } finally {
      // Cancel before the prerequisite run owner waits for pending setup.
      closing = true;
    }
  },
  calendarState: async ({ _calendarSetup }, use) => {
    await use(await _calendarSetup.prepare());
  },
});
