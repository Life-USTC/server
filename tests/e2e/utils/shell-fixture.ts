import type { User } from "../../../src/generated/prisma-node/client";
import { test as communityTest } from "./community-fixture";
import { DEV_SEED } from "./dev-seed";
import { withE2ePrisma } from "./e2e-db/prisma";

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
  administrator: async ({ account }, use) => {
    await use(
      await withE2ePrisma((db) =>
        db.user.update({
          where: { id: account.id },
          data: { isAdmin: true },
        }),
      ),
    );
  },
  historical: async ({ account, community, page }, use) => {
    const courseName = `Historical course ${community.course.jwId}`;
    const homeworkTitle = `Historical homework ${community.section.jwId}`;
    const dates = DEV_SEED.previousSemesterScheduleDates;
    try {
      const semesterId = await withE2ePrisma((db) =>
        db.$transaction(async (tx) => {
          const semester = await tx.semester.findUniqueOrThrow({
            where: { jwId: DEV_SEED.previousSemesterJwId },
          });
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
    } finally {
      try {
        await page.close();
      } finally {
        // Schedule relations do not cascade when the owning catalog is deleted.
        await withE2ePrisma((db) =>
          db.$transaction([
            db.schedule.deleteMany({
              where: { sectionId: community.section.id },
            }),
            db.scheduleGroup.deleteMany({
              where: { sectionId: community.section.id },
            }),
          ]),
        );
      }
    }
  },
});
