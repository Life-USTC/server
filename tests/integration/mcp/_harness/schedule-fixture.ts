import type { TestPrismaClient } from "../../../shared/prisma";

/** Known meetings on both sides of the date filters, without a seed graph. */
export async function createPrivateMcpSchedules(
  db: TestPrismaClient,
  sectionId: number,
) {
  return db.$transaction(async (tx) => {
    const group = await tx.scheduleGroup.create({
      data: {
        jwId: 1,
        sectionId,
        no: 1,
        limitCount: 30,
        stdCount: 10,
        actualPeriods: 6,
        isDefault: true,
      },
    });
    const meetings = [];
    for (const [date, weekday, weekIndex] of [
      ["2026-04-29", 3, 1],
      ["2026-05-02", 6, 1],
      ["2026-05-12", 2, 3],
    ] as const) {
      meetings.push(
        await tx.schedule.create({
          data: {
            sectionId,
            scheduleGroupId: group.id,
            date: new Date(`${date}T00:00:00.000Z`),
            weekday,
            weekIndex,
            periods: 2,
            startTime: 830,
            endTime: 1000,
            startUnit: 1,
            endUnit: 2,
            customPlace: "MCP classroom",
          },
          select: { id: true, date: true, startTime: true, endTime: true },
        }),
      );
    }
    return meetings;
  });
}
