import type { IsolatedWorker } from "../../../../utils/isolated-worker";

type Database = IsolatedWorker["database"]["owner"];
export const facts = {
  semesterJwId: 1,
  course: { jwId: 1, code: "MCP1001", nameCn: "MCP验证课程" },
  section: { jwId: 1, code: "MCP1001.01" },
  teacher: { jwId: 1, code: "MCPTEACHER", nameCn: "验证教师" },
  roomJwId: 1,
  homeworks: { title: "独立教学班作业" },
  todos: { dueTodayTitle: "独立待办事项", completedTitle: "已完成待办事项" },
  bus: {
    versionTitle: "Private MCP timetable",
    routeId: 1,
    recommendedRouteId: 1,
    originCampusId: 1,
    destinationCampusId: 2,
  },
} as const;
export const anchor = {
  date: "2026-04-29",
  startOfDayAtTime: "2026-04-29T00:00:00+08:00",
  recommendedAtTime: "2026-04-29T08:00:00+08:00",
} as const;

export async function arrangeSection(db: Database) {
  const semester = await db.semester.create({
    data: {
      jwId: facts.semesterJwId,
      code: "421",
      nameCn: "验证学期",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
    },
  });
  const course = await db.course.create({ data: facts.course });
  return db.section.create({
    data: { ...facts.section, courseId: course.id, semesterId: semester.id },
  });
}

export async function arrangeAcademic(db: Database) {
  const section = await arrangeSection(db);
  const teacher = await db.teacher.create({ data: facts.teacher });
  await db.section.update({
    where: { id: section.id },
    data: { teachers: { connect: { id: teacher.id } } },
  });
  const room = await db.room.create({
    data: {
      jwId: facts.roomJwId,
      nameCn: "验证教室",
      code: "101",
      virtual: false,
      seats: 30,
      seatsForSection: 30,
    },
  });
  const group = await db.scheduleGroup.create({
    data: {
      jwId: 1,
      sectionId: section.id,
      no: 1,
      limitCount: 30,
      stdCount: 1,
      actualPeriods: 2,
      isDefault: true,
    },
  });
  await db.schedule.create({
    data: {
      sectionId: section.id,
      scheduleGroupId: group.id,
      roomId: room.id,
      periods: 2,
      date: new Date(anchor.date),
      weekday: 3,
      startTime: 900,
      endTime: 1000,
      weekIndex: 8,
      startUnit: 1,
      endUnit: 2,
      teacherParticipations: { create: { teacherId: teacher.id } },
    },
  });
  await db.exam.create({
    data: {
      jwId: 1,
      sectionId: section.id,
      examDate: new Date(anchor.date),
      startTime: 1300,
      endTime: 1400,
      examMode: "闭卷",
    },
  });
  return section;
}

export async function arrangeHomework(
  db: Database,
  userId: string,
  sectionId: number,
) {
  return db.homework.create({
    data: {
      sectionId,
      createdById: userId,
      title: facts.homeworks.title,
      submissionDueAt: new Date("2026-04-29T12:00:00+08:00"),
    },
  });
}

export async function arrangeBus(db: Database) {
  const campuses = [
    { id: 1, name: "验证东区", latitude: 31.84, longitude: 117.26 },
    { id: 2, name: "验证西区", latitude: 31.85, longitude: 117.27 },
  ];
  await db.busCampus.createMany({
    data: campuses.map(({ name, ...campus }) => ({ ...campus, nameCn: name })),
  });
  const route = { id: facts.bus.routeId, campuses };
  await db.busRoute.create({
    data: {
      id: route.id,
      nameCn: "验证东区至西区",
      stops: {
        create: campuses.map(({ id }, index) => ({
          campusId: id,
          stopOrder: index + 1,
        })),
      },
    },
  });
  const times = [
    ["09:00", "09:20"],
    ["23:00", "23:20"],
  ];
  const routes = [{ id: route.id, route, time: times }];
  await db.busScheduleVersion.create({
    data: {
      key: "private-mcp",
      title: facts.bus.versionTitle,
      checksum: "private-mcp",
      rawJson: {
        campuses,
        routes: [route],
        weekday_routes: routes,
        saturday_routes: routes,
        sunday_routes: routes,
        message: {
          message: facts.bus.versionTitle,
          url: "https://example.test/bus",
        },
      },
      trips: {
        create: (["weekday", "saturday", "sunday"] as const).flatMap(
          (dayType) =>
            times.map((stopTimes, position) => ({
              routeId: route.id,
              dayType,
              position,
              stopTimes,
            })),
        ),
      },
    },
  });
}
