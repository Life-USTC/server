import type { Prisma } from "../../../src/generated/prisma-node/client";
import scenario from "../fixtures/scenario.json" with { type: "json" };

/** Private catalog rows used by populated mobile page checks. */
export async function createMobileCourseCatalog(db: Prisma.TransactionClient) {
  const [category, classType, classify, educationLevel, gradation, type] =
    await Promise.all([
      db.courseCategory.create({ data: scenario.catalog.category }),
      db.classType.create({ data: scenario.catalog.classType }),
      db.courseClassify.create({ data: scenario.catalog.classify }),
      db.educationLevel.create({ data: scenario.catalog.educationLevel }),
      db.courseGradation.create({ data: scenario.catalog.gradation }),
      db.courseType.create({ data: scenario.catalog.courseType }),
    ]);
  return Promise.all(
    scenario.courses.map(({ index: _index, ...course }) =>
      db.course.create({
        data: {
          ...course,
          categoryId: category.id,
          classTypeId: classType.id,
          classifyId: classify.id,
          educationLevelId: educationLevel.id,
          gradationId: gradation.id,
          typeId: type.id,
        },
      }),
    ),
  );
}
export type MobileCatalog = Awaited<
  ReturnType<typeof createMobileCourseCatalog>
>;

/** Preserve the overview's calendar, counts and task state without shared seed rows. */
export async function createMobileWorkspaceCatalog(
  db: Prisma.TransactionClient,
  courses: MobileCatalog,
) {
  const current = await db.semester.create({
    data: {
      ...scenario.semester,
      startDate: new Date("2026-04-08T00:00:00Z"),
      endDate: new Date("2026-09-06T00:00:00Z"),
    },
  });
  const previous = await db.semester.create({
    data: {
      jwId: scenario.previousSemester.jwId,
      code: scenario.previousSemester.code,
      nameCn: scenario.previousSemester.nameCn,
      startDate: new Date("2025-10-21T00:00:00Z"),
      endDate: new Date("2026-03-30T00:00:00Z"),
    },
  });
  const campus = await db.campus.create({ data: scenario.catalog.campus });
  const department = await db.department.create({
    data: scenario.catalog.department,
  });
  const roomType = await db.roomType.create({
    data: scenario.catalog.roomType,
  });
  const building = await db.building.create({
    data: { ...scenario.catalog.building, campusId: campus.id },
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
  const teacherTitle = await db.teacherTitle.create({
    data: { ...scenario.catalog.teacherTitle, enabled: true },
  });
  const teachers = await Promise.all(
    scenario.teachers.map(({ index: _index, ...teacher }) =>
      db.teacher.create({
        data: {
          ...teacher,
          address: "中国科学技术大学",
          departmentId: department.id,
          teacherTitleId: teacherTitle.id,
        },
      }),
    ),
  );
  const examMode = await db.examMode.create({
    data: scenario.catalog.examMode,
  });
  const teachLanguage = await db.teachLanguage.create({
    data: scenario.catalog.teachLanguage,
  });
  const sections = await Promise.all(
    scenario.sections.map((section) =>
      db.section.create({
        data: {
          jwId: section.jwId,
          code: section.code,
          credits: section.credits,
          period: section.credits * 16,
          periodsPerWeek: 2,
          timesPerWeek: 2,
          stdCount: section.stdCount,
          limitCount: section.limitCount,
          remark: section.remark,
          scheduleRemark: "包含早课、午后与晚课时段。",
          courseId: courses[section.index].id,
          semesterId:
            section.semester === "previous" ? previous.id : current.id,
          campusId: campus.id,
          examModeId: examMode.id,
          openDepartmentId: department.id,
          teachLanguageId: teachLanguage.id,
          roomTypeId: roomType.id,
          teachers: {
            connect: section.teacherIndexes.map((index) => ({
              id: teachers[index].id,
            })),
          },
          sectionTeachers: {
            create: section.teacherIndexes.map((index) => ({
              teacherId: teachers[index].id,
            })),
          },
        },
      }),
    ),
  );
  const groups = await Promise.all(
    scenario.sections.map((section) =>
      Promise.all(
        [0, 1].map((index) =>
          db.scheduleGroup.create({
            data: {
              jwId: scenario.scheduleGroups[section.index * 2 + index],
              sectionId: sections[section.index].id,
              no: index + 1,
              limitCount: section.limitCount,
              stdCount: section.stdCount,
              actualPeriods: 2,
              isDefault: index === 0,
            },
          }),
        ),
      ),
    ),
  );
  const schedules = [
    {
      section: 0,
      group: 0,
      date: "2026-04-29",
      weekday: 3,
      startTime: 840,
      endTime: 1030,
      startUnit: 2,
      endUnit: 3,
    },
    {
      section: 0,
      group: 1,
      date: "2026-04-30",
      weekday: 4,
      startTime: 1400,
      endTime: 1535,
      startUnit: 6,
      endUnit: 7,
    },
    {
      section: 0,
      group: 0,
      date: "2026-05-01",
      weekday: 5,
      startTime: 1530,
      endTime: 1700,
      startUnit: 0,
      endUnit: 0,
      customPlace: "东校区体育场",
    },
    {
      section: 1,
      group: 0,
      date: "2026-04-30",
      weekday: 4,
      startTime: 750,
      endTime: 925,
      startUnit: 1,
      endUnit: 2,
    },
    {
      section: 1,
      group: 1,
      date: "2026-05-01",
      weekday: 5,
      startTime: 1400,
      endTime: 1535,
      startUnit: 6,
      endUnit: 7,
    },
    {
      section: 2,
      group: 0,
      date: "2026-05-01",
      weekday: 5,
      startTime: 750,
      endTime: 925,
      startUnit: 1,
      endUnit: 2,
    },
    {
      section: 2,
      group: 1,
      date: "2026-05-02",
      weekday: 6,
      startTime: 1400,
      endTime: 1535,
      startUnit: 6,
      endUnit: 7,
    },
    {
      section: 3,
      group: 0,
      date: "2026-03-28",
      weekday: 6,
      startTime: 750,
      endTime: 925,
      startUnit: 1,
      endUnit: 2,
    },
    {
      section: 3,
      group: 1,
      date: "2026-03-29",
      weekday: 7,
      startTime: 1400,
      endTime: 1535,
      startUnit: 6,
      endUnit: 7,
    },
  ];
  for (const { section, group, date, ...schedule } of schedules) {
    await db.schedule.create({
      data: {
        ...schedule,
        date: new Date(`${date}T00:00:00Z`),
        periods: 2,
        weekIndex: 2,
        sectionId: sections[section].id,
        scheduleGroupId: groups[section][group].id,
        roomId: schedule.customPlace ? null : room.id,
        teacherParticipations: {
          create: scenario.sections[section].teacherIndexes.map((index) => ({
            teacherId: teachers[index].id,
          })),
        },
      },
    });
  }
  const examBatch = await db.examBatch.create({
    data: { jwId: 9910081, ...scenario.catalog.examBatch },
  });
  for (const [index, date] of [
    "2026-05-09",
    "2026-05-10",
    "2026-05-11",
    "2026-03-20",
  ].entries()) {
    await db.exam.create({
      data: {
        jwId: scenario.exams[index].jwId,
        sectionId: sections[index].id,
        examType: 1,
        examTakeCount: 1,
        examMode: "闭卷",
        examDate: new Date(`${date}T00:00:00Z`),
        startTime: 900,
        endTime: 1100,
        examBatchId: examBatch.id,
        examRooms: {
          create: { room: scenario.catalog.room.nameCn, count: 30 + index * 5 },
        },
      },
    });
  }
  // The reader did not author the shared seed's homework; preserve that scope.
  const author = await db.user.create({
    data: {
      name: scenario.users.debug.name,
      username: "mobile-homework-author",
      email: "mobile-homework-author@example.test",
      emailVerified: true,
    },
  });
  const homeworks = [
    {
      title: scenario.homeworks.completedTitle,
      section: 0,
      due: "2026-04-27T12:00:00Z",
      content: "作业要求：提交仓库链接和测试截图。",
    },
    {
      title: scenario.homeworks.overdueTitle,
      section: 0,
      due: "2026-04-28T14:00:00Z",
      isMajor: true,
      content: "逾期补交实验数据，保留原始记录并说明补交原因。",
    },
    {
      title: scenario.homeworks.dueTodayTitle,
      section: 0,
      due: "2026-04-29T15:00:00Z",
      content: "整理今日课堂反馈，标注需要二次确认的问题。",
    },
    {
      title: scenario.homeworks.title,
      section: 0,
      due: "2026-05-03T15:00:00Z",
      isMajor: true,
      requiresTeam: true,
      content:
        "完成系统设计文档，包含模块划分与接口说明，并在评审会上做 10 分钟展示。",
    },
    {
      title: "线性变换证明题",
      section: 1,
      due: "2026-05-01T14:00:00Z",
      content: "证明题需写出完整推导过程，可参考教材第三章习题 3.2。",
    },
    {
      title: "特征值综合练习",
      section: 1,
      due: "2026-05-05T14:00:00Z",
      content: "综合运用特征值与特征向量，建议先化简再计算。",
    },
    {
      title: "实验报告与误差分析",
      section: 2,
      due: "2026-05-02T13:00:00Z",
      isMajor: true,
      requiresTeam: true,
      content: "实验报告需包含：实验目的、步骤、数据记录、误差分析与结论。",
    },
    {
      title: scenario.homeworks.historicalTitle,
      section: 3,
      due: "2026-03-20T12:00:00Z",
      content: "历史学期复盘作业用于验证跨学期订阅数据。",
    },
    {
      title: "已删除作业",
      section: 0,
      due: "2026-05-04T15:00:00Z",
      deletedAt: new Date("2026-04-29T04:00:00Z"),
    },
  ];
  for (const [index, homework] of homeworks.entries()) {
    await db.homework.create({
      data: {
        title: homework.title,
        sectionId: sections[homework.section].id,
        createdById: author.id,
        updatedById: author.id,
        publishedAt: new Date("2026-04-28T01:00:00Z"),
        submissionStartAt: new Date("2026-04-28T01:00:00Z"),
        submissionDueAt: new Date(homework.due),
        createdAt: new Date("2026-06-27T07:38:09.995Z"),
        updatedAt: new Date(
          homework.deletedAt
            ? "2026-06-27T07:38:10.004Z"
            : "2026-06-27T07:38:09.995Z",
        ),
        isMajor: homework.isMajor ?? false,
        requiresTeam: homework.requiresTeam ?? false,
        deletedAt: homework.deletedAt,
        deletedById: homework.deletedAt ? author.id : null,
        description: homework.content
          ? {
              create: {
                content: homework.content,
                lastEditedById: author.id,
                lastEditedAt: new Date(`2026-04-28T14:${30 + index}:00Z`),
              },
            }
          : undefined,
      },
    });
  }
}
