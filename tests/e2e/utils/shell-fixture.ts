import type { User } from "../../../src/generated/prisma-node/client";
import { test as communityTest } from "./community-fixture";

type History = {
  sectionId: number;
  semesterId: number;
  courseName: string;
  homeworkTitle: string;
  dates: readonly string[];
};

export const test = communityTest.extend<{
  administrator: User;
  historical: History;
}>({
  administrator: async ({ account, isolatedWorker, run }, use) => {
    await use(
      await run(() =>
        isolatedWorker.database.owner.user.update({
          where: { id: account.id },
          data: { isAdmin: true },
        }),
      ),
    );
  },
  historical: async ({ account, community, run }, use) => {
    const db = community.db;
    const courseName = `Historical course ${community.course.jwId}`;
    const homeworkTitle = `Historical homework ${community.section.jwId}`;
    const previousEnd = community.semesters.previous.endDate;
    if (!previousEnd)
      throw new Error("Historical fixture requires a semester end date");
    const dates = [-2, -1].map((offset) =>
      new Date(previousEnd.getTime() + offset * 86_400_000)
        .toISOString()
        .slice(0, 10),
    );
    const semesterId = await run(() =>
      db.$transaction(async (tx) => {
        const semester = community.semesters.previous;
        await tx.course.update({
          where: { id: community.course.id },
          data: { nameCn: courseName, nameEn: courseName },
        });
        await tx.section.update({
          where: { id: community.section.id },
          data: { semesterId: semester.id },
        });
        await tx.userSectionSubscription.create({
          data: { userId: account.id, sectionId: community.section.id },
        });
        const group = await tx.scheduleGroup.create({
          data: {
            jwId: community.section.jwId,
            sectionId: community.section.id,
            no: 1,
            limitCount: 20,
            stdCount: 1,
            actualPeriods: 2,
            isDefault: true,
          },
        });
        for (const date of dates) {
          await tx.schedule.create({
            data: {
              sectionId: community.section.id,
              scheduleGroupId: group.id,
              date: new Date(`${date}T00:00:00Z`),
              weekday: new Date(`${date}T00:00:00Z`).getUTCDay() || 7,
              startTime: 900,
              endTime: 1000,
              startUnit: 1,
              endUnit: 2,
              weekIndex: 8,
              periods: 2,
            },
          });
        }
        await tx.homework.create({
          data: {
            sectionId: community.section.id,
            createdById: account.id,
            title: homeworkTitle,
            submissionDueAt: new Date(`${dates[0]}T12:00:00+08:00`),
          },
        });
        return semester.id;
      }),
    );
    await use({
      sectionId: community.section.id,
      semesterId,
      courseName,
      homeworkTitle,
      dates,
    });
  },
});
