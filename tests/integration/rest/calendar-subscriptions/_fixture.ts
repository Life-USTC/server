import type { APIRequestContext } from "@playwright/test";
import { DEV_SEED } from "../../../fixtures/dev-seed";
import {
  createFixturePrisma,
  type TestPrismaClient,
} from "../../../shared/prisma";
import { test as actorTest } from "../_harness/actor";

type Actor = { id: string; request: APIRequestContext };
type Section = { id: number; jwId: number; code: string; semesterId: number };
type CalendarState = {
  db: TestPrismaClient;
  owner: Actor;
  other: Actor;
  section: Section;
  second: Section;
  previous: Section;
  scheduleGroupId: number;
  teacherId: number;
};

export const test = actorTest.extend<{ calendarState: CalendarState }>({
  calendarState: async ({ createActor }, use) => {
    const db = createFixturePrisma();
    const marker = `rest-calendar-${crypto.randomUUID()}`;
    const codes = [0, 1, 2].map((index) => `${marker}-${index}`);
    try {
      const owner = await createActor();
      const other = await createActor();
      const source = await db.section.findUniqueOrThrow({
        where: { jwId: DEV_SEED.section.jwId },
        select: { courseId: true, semesterId: true },
      });
      const previousSource = await db.section.findUniqueOrThrow({
        where: { jwId: DEV_SEED.previousSection.jwId },
        select: { courseId: true, semesterId: true },
      });
      if (source.semesterId === null || previousSource.semesterId === null) {
        throw new Error("The immutable calendar prerequisites need semesters");
      }
      const teacher = await db.teacher.findUniqueOrThrow({
        where: { jwId: DEV_SEED.teacher.jwId },
        select: { id: true },
      });
      const { section, second, previous, group } = await db.$transaction(
        async (tx) => {
          const sections: Section[] = [];
          for (const [index, data] of [
            source,
            source,
            previousSource,
          ].entries()) {
            sections.push(
              await tx.section.create({
                data: {
                  ...data,
                  semesterId: data.semesterId as number,
                  code: codes[index],
                  jwId: 1_800_000_000 + Math.floor(Math.random() * 100_000_000),
                },
              }),
            );
          }
          const [section, second, previous] = sections;
          const group = await tx.scheduleGroup.create({
            data: {
              sectionId: section.id,
              jwId: section.jwId,
              no: 1,
              limitCount: 10,
              stdCount: 0,
              actualPeriods: 2,
              isDefault: true,
            },
          });
          return { section, second, previous, group };
        },
      );
      await use({
        db,
        owner,
        other,
        section,
        second,
        previous,
        scheduleGroupId: group.id,
        teacherId: teacher.id,
      });
    } finally {
      try {
        const sections = await db.section.findMany({
          where: { code: { in: codes } },
          select: { id: true },
        });
        const sectionIds = sections.map(({ id }) => id);
        // Schedule and group relations restrict deletion, unlike homework/exam cascades.
        await db.schedule.deleteMany({
          where: { sectionId: { in: sectionIds } },
        });
        await db.scheduleGroup.deleteMany({
          where: { sectionId: { in: sectionIds } },
        });
        await db.section.deleteMany({ where: { id: { in: sectionIds } } });
      } finally {
        await db.$disconnect();
      }
    }
  },
});
