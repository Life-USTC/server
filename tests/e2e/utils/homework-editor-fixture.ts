import { formatShanghaiDate } from "@/lib/time/shanghai-format";
import type { TestPrismaClient } from "../../shared/prisma";
import { DEV_SEED } from "./dev-seed";
import {
  test as filterTest,
  type WorkspaceTaskFilterState,
} from "./workspace-task-filters";

async function createHomeworkEditorState(
  db: TestPrismaClient,
  fixture: WorkspaceTaskFilterState,
) {
  const nextDates = [2, 4].map((days) =>
    formatShanghaiDate(new Date(Date.now() + days * 86_400_000)),
  );
  return db.$transaction(async (tx) => {
    const first = await tx.section.findUniqueOrThrow({
      where: { id: fixture.sectionId },
    });
    const second = await tx.section.create({
      data: {
        code: `${first.code}-second`,
        jwId: 1_500_000_004,
        courseId: first.courseId,
        semesterId: first.semesterId,
      },
    });
    await tx.userSectionSubscription.create({
      data: { userId: fixture.userId, sectionId: second.id },
    });
    const teacher = await tx.teacher.create({
      data: { jwId: DEV_SEED.teacher.jwId, nameCn: DEV_SEED.teacher.nameCn },
    });
    for (const [index, section] of [first, second].entries()) {
      await tx.section.update({
        where: { id: section.id },
        data: { teachers: { connect: { id: teacher.id } } },
      });
      const group = await tx.scheduleGroup.create({
        data: {
          sectionId: section.id,
          jwId: 1_500_000_005 + index,
          no: 1,
          limitCount: 30,
          stdCount: 1,
          actualPeriods: 2,
          isDefault: true,
        },
      });
      await tx.schedule.create({
        data: {
          sectionId: section.id,
          scheduleGroupId: group.id,
          date: new Date(`${nextDates[index]}T00:00:00Z`),
          weekday: new Date(`${nextDates[index]}T00:00:00Z`).getUTCDay(),
          startTime: 800,
          endTime: 945,
          startUnit: 1,
          endUnit: 2,
          periods: 2,
          weekIndex: 1,
        },
      });
    }
    return {
      ...fixture,
      sections: [first, second],
      dueValues: nextDates.map((date) => `${date}T08:00`),
    };
  });
}

export const test = filterTest.extend<{
  homeworkEditor: Awaited<ReturnType<typeof createHomeworkEditorState>>;
}>({
  homeworkEditor: async ({ taskFilterState, taskFilterDb }, use) => {
    const fixture = await taskFilterState(false);
    await use(
      await taskFilterDb((db) => createHomeworkEditorState(db, fixture)),
    );
  },
});
