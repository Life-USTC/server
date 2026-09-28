import type { Prisma } from "../../../src/generated/prisma-node/client";
import { DEV_SEED, DEV_SEED_ANCHOR } from "./dev-seed";
import { withE2ePrisma } from "./e2e-db/prisma";

type CalendarDatabase = {
  $transaction<T>(
    run: (db: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T>;
};
type WithCalendarDatabase = <T>(
  run: (db: CalendarDatabase) => Promise<T>,
) => Promise<T>;

export async function createCalendarContractFixture(
  withDatabase: WithCalendarDatabase = withE2ePrisma,
) {
  const marker = crypto.randomUUID().slice(0, 8);
  const date = DEV_SEED_ANCHOR.date;
  const activityDate = "2026-04-30";
  const created = await withDatabase((client) =>
    client.$transaction(async (db) => {
      const seed = await db.section.findUniqueOrThrow({
        where: { jwId: DEV_SEED.section.jwId },
      });
      const users = [];
      for (const role of ["academic", "activity"]) {
        const name = `calendar-${role}-${marker}`;
        users.push(
          await db.user.create({
            data: {
              name,
              username: `cal${role}${marker}`,
              email: `${name}@example.test`,
              emailVerified: true,
            },
          }),
        );
      }
      const jwId = 1_800_000_000 + Math.floor(Math.random() * 100_000_000);
      const course = await db.course.create({
        data: {
          jwId,
          code: `CAL${marker}`,
          nameCn: `日历验证课程 ${marker}`,
          nameEn: `Calendar contract ${marker}`,
        },
      });
      const section = await db.section.create({
        data: {
          jwId: jwId + 1,
          code: `${course.code}.01`,
          courseId: course.id,
          semesterId: seed.semesterId,
        },
      });
      await db.userSectionSubscription.create({
        data: { userId: users[0].id, sectionId: section.id },
      });
      const group = await db.scheduleGroup.create({
        data: {
          jwId: jwId + 2,
          sectionId: section.id,
          no: 1,
          limitCount: 20,
          stdCount: 1,
          actualPeriods: 2,
          isDefault: true,
        },
      });
      await db.schedule.create({
        data: {
          sectionId: section.id,
          scheduleGroupId: group.id,
          date: new Date(`${date}T00:00:00Z`),
          weekday: 3,
          startTime: 900,
          endTime: 1000,
          startUnit: 1,
          endUnit: 2,
          weekIndex: 8,
          periods: 2,
          customPlace: "Calendar teaching room",
        },
      });
      const homework = await db.homework.create({
        data: {
          sectionId: section.id,
          createdById: users[0].id,
          title: `Calendar homework ${marker}`,
          submissionDueAt: new Date(`${date}T12:00:00+08:00`),
        },
      });
      await db.exam.create({
        data: {
          sectionId: section.id,
          jwId: jwId + 3,
          examDate: new Date(`${date}T00:00:00Z`),
          startTime: 1300,
          endTime: 1400,
          examType: 1,
          examTakeCount: 1,
          examMode: "Calendar closed book",
        },
      });
      const todo = await db.todo.create({
        data: {
          userId: users[0].id,
          title: `Calendar todo ${marker}`,
          dueAt: new Date(`${date}T15:00:00+08:00`),
        },
      });
      const young = await db.youngEvent.create({
        data: {
          youngId: `calendar-activity-${marker}`,
          name: `Calendar activity ${marker}`,
          startAt: new Date(`${activityDate}T16:00:00+08:00`),
          endAt: new Date(`${activityDate}T17:00:00+08:00`),
          isActive: true,
          location: "Calendar activity room",
          rawJson: {},
        },
      });
      for (const user of users)
        await db.userYoungEventSubscription.create({
          data: {
            userId: user.id,
            youngId: young.youngId,
            observedState: "{}",
          },
        });
      return { users, course, section, group, homework, todo, young };
    }),
  );
  return {
    ...created,
    date,
    activityDate,
    academicUrl: (view = "week") =>
      `/workspace/calendar?calendarView=${view}&calendarDay=${date}&calendarWeek=${date}&calendarMonth=2026-04&calendarSemester=${created.section.semesterId}&snapshotAt=${encodeURIComponent(DEV_SEED_ANCHOR.recommendedAtTime)}`,
    cleanup: async () => {
      await withDatabase((client) =>
        client.$transaction(async (db) => {
          const userIds = created.users.map(({ id }) => id);
          const homeworks = await db.homework.findMany({
            where: { sectionId: created.section.id },
            select: {
              id: true,
              comments: { select: { id: true } },
              description: { select: { id: true } },
            },
          });
          const targets = homeworks.flatMap((homework) => [
            { targetType: "homework", targetId: homework.id },
            ...homework.comments.map(({ id }) => ({
              targetType: "comment",
              targetId: id,
            })),
            ...(homework.description
              ? [
                  {
                    targetType: "description",
                    targetId: homework.description.id,
                  },
                ]
              : []),
          ]);
          await db.auditLog.deleteMany({
            where: {
              OR: [
                { userId: { in: userIds } },
                { subjectUserId: { in: userIds } },
                ...targets,
              ],
            },
          });
          await db.schedule.deleteMany({
            where: { sectionId: created.section.id },
          });
          await db.scheduleGroup.delete({ where: { id: created.group.id } });
          await db.exam.deleteMany({
            where: { sectionId: created.section.id },
          });
          await db.featureOperationEvent.deleteMany({
            where: { userId: { in: userIds } },
          });
          await db.user.deleteMany({
            where: { id: { in: userIds } },
          });
          await db.youngEvent.delete({
            where: { youngId: created.young.youngId },
          });
          await db.section.delete({ where: { id: created.section.id } });
          await db.course.delete({ where: { id: created.course.id } });
        }),
      );
    },
  };
}
