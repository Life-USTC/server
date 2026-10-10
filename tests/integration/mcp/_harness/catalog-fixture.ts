import type { TestPrismaClient } from "../../../shared/prisma";
import { isolatedMcpTest } from "./isolated-context";

/** Small public catalog graph used by directory and mode consumers. */
export async function createPrivateMcpCatalog(db: TestPrismaClient) {
  return db.$transaction(async (tx) => {
    // One Shanghai civil day drives both the live current-semester queries
    // and the explicit schedule/deadline inputs; no fixed-year rows can drift.
    const date = new Date().toLocaleDateString("sv-SE", {
      timeZone: "Asia/Shanghai",
    });
    const day = new Date(`${date}T00:00:00.000Z`);
    const weekday = day.getUTCDay() || 7;
    const dateAfterDays = (offset: number) =>
      new Date(day.getTime() + offset * 86_400_000);
    const mondayOffset = 1 - weekday;
    const semester = await tx.semester.create({
      data: {
        jwId: 10,
        code: "mcp-current",
        nameCn: "MCP 当前学期",
        startDate: dateAfterDays(mondayOffset),
        endDate: dateAfterDays(mondayOffset + 125),
      },
    });
    const previousSemester = await tx.semester.create({
      data: {
        jwId: 11,
        code: "mcp-previous",
        nameCn: "MCP 历史学期",
        startDate: dateAfterDays(mondayOffset - 126),
        endDate: dateAfterDays(mondayOffset - 1),
      },
    });
    const category = await tx.courseCategory.create({
      data: { nameCn: "专业课" },
    });
    const classType = await tx.classType.create({ data: { nameCn: "必修" } });
    const educationLevel = await tx.educationLevel.create({
      data: { nameCn: "本科" },
    });
    const course = await tx.course.create({
      data: {
        jwId: 10,
        code: "MCP1001",
        nameCn: "测试课程",
        nameEn: "Catalog course",
        categoryId: category.id,
        classTypeId: classType.id,
        educationLevelId: educationLevel.id,
      },
    });
    const teacher = await tx.teacher.create({
      data: {
        jwId: 10,
        code: "MCP-TEACHER",
        nameCn: "测试教师",
        nameEn: "Catalog teacher",
      },
    });
    const section = await tx.section.create({
      data: {
        jwId: 10,
        code: "MCP1001.01",
        courseId: course.id,
        semesterId: semester.id,
        teachers: { connect: { id: teacher.id } },
        teacherAssignments: {
          create: { teacherId: teacher.id, role: "主讲", period: 2 },
        },
      },
    });
    const previousSection = await tx.section.create({
      data: {
        jwId: 11,
        code: "MATH2001.01",
        courseId: course.id,
        semesterId: previousSemester.id,
      },
    });
    const group = await tx.scheduleGroup.create({
      data: {
        jwId: 10,
        sectionId: section.id,
        no: 1,
        limitCount: 30,
        stdCount: 10,
        actualPeriods: 2,
        isDefault: true,
      },
    });
    const schedule = await tx.schedule.create({
      data: {
        sectionId: section.id,
        scheduleGroupId: group.id,
        date: day,
        weekday,
        weekIndex: 1,
        periods: 2,
        startTime: 830,
        endTime: 1000,
        startUnit: 1,
        endUnit: 2,
        customPlace: "Catalog classroom",
        teacherParticipations: {
          create: { teacherId: teacher.id, periods: 2, exerciseClass: false },
        },
      },
    });
    const exam = await tx.exam.create({
      data: {
        jwId: 10,
        sectionId: section.id,
        examDate: dateAfterDays(1),
        examMode: "闭卷",
        monitors: [
          {
            jwId: 1001,
            nameCn: "测试监考教师",
            nameEn: "Test exam monitor",
          },
        ],
        examRooms: { create: { room: "Catalog exam room", count: 30 } },
        startTime: 900,
        endTime: 1100,
      },
    });
    return {
      date,
      atTime: `${date}T08:00:00+08:00`,
      elevenDaysLater: dateAfterDays(11).toISOString().slice(0, 10),
      semester,
      previousSemester,
      course,
      category,
      classType,
      educationLevel,
      teacher,
      section,
      previousSection,
      schedule,
      exam,
    };
  });
}

export const catalogMcpTest = isolatedMcpTest.extend(
  "mcpCatalog",
  async ({ isolatedDatabase, mcpWorkflow, signal }) => {
    const catalog = await mcpWorkflow.run(() =>
      createPrivateMcpCatalog(isolatedDatabase.owner),
    );
    signal.throwIfAborted();
    return catalog;
  },
);
