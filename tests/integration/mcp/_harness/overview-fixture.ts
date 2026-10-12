import type { TestPrismaClient } from "../../../shared/prisma";

/** Facts consumed by overview projections; no mutable shared seed records. */
export async function createPrivateMcpOverview(
  db: TestPrismaClient,
  userId: string,
  sectionId: number,
) {
  return db.$transaction(async (tx) => {
    const section = await tx.section.findUniqueOrThrow({
      where: { id: sectionId },
      select: { semesterId: true },
    });
    if (section.semesterId === null)
      throw new Error("Overview section needs a semester");
    await tx.semester.update({
      where: { id: section.semesterId },
      data: {
        startDate: new Date("2026-04-01T00:00:00.000Z"),
        endDate: new Date("2026-08-31T00:00:00.000Z"),
      },
    });
    await tx.userSectionSubscription.create({ data: { userId, sectionId } });
    const homework = await tx.homework.create({
      data: {
        sectionId,
        title: "Overview upcoming homework",
        submissionDueAt: new Date("2026-04-30T18:00:00+08:00"),
        createdById: userId,
        updatedById: userId,
        isMajor: false,
        requiresTeam: false,
      },
      select: { id: true, title: true },
    });
    const exam = await tx.exam.create({
      data: {
        jwId: 1,
        sectionId,
        examDate: new Date("2026-04-30T00:00:00.000Z"),
        startTime: 900,
        endTime: 1100,
      },
      select: { id: true, jwId: true },
    });
    return { homework, exam };
  });
}

/** Only the historical consumer case needs a previous academic term. */
export async function createPrivateMcpHistoricalOverview(
  db: TestPrismaClient,
  userId: string,
  currentSectionId: number,
) {
  return db.$transaction(async (tx) => {
    const current = await tx.section.findUniqueOrThrow({
      where: { id: currentSectionId },
      select: { courseId: true },
    });
    const semester = await tx.semester.create({
      data: {
        jwId: 2,
        code: "mcp-previous-semester",
        nameCn: "MCP 上一学期",
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: new Date("2026-03-31T00:00:00.000Z"),
      },
    });
    const section = await tx.section.create({
      data: {
        jwId: 2,
        code: "MCP.PREVIOUS",
        courseId: current.courseId,
        semesterId: semester.id,
      },
    });
    const group = await tx.scheduleGroup.create({
      data: {
        jwId: 2,
        sectionId: section.id,
        no: 1,
        limitCount: 30,
        stdCount: 10,
        isDefault: true,
        actualPeriods: 2,
      },
    });
    const schedule = await tx.schedule.create({
      data: {
        sectionId: section.id,
        scheduleGroupId: group.id,
        date: new Date("2026-03-28T00:00:00.000Z"),
        weekday: 6,
        weekIndex: 13,
        periods: 2,
        startTime: 830,
        endTime: 1000,
        startUnit: 1,
        endUnit: 2,
      },
    });
    const homework = await tx.homework.create({
      data: {
        sectionId: section.id,
        title: "历史学期复盘作业",
        submissionDueAt: new Date("2026-03-30T18:00:00+08:00"),
        createdById: userId,
        updatedById: userId,
        isMajor: false,
        requiresTeam: false,
      },
    });
    const exam = await tx.exam.create({
      data: {
        jwId: 2,
        sectionId: section.id,
        examDate: new Date("2026-03-31T00:00:00.000Z"),
        startTime: 900,
        endTime: 1100,
      },
    });
    await tx.userSectionSubscription.deleteMany({ where: { userId } });
    await tx.userSectionSubscription.create({
      data: { userId, sectionId: section.id },
    });
    return { section, schedule, homework, exam };
  });
}
