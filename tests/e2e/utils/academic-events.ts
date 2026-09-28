import type { Exam } from "../../../src/generated/prisma-node/client";
import { DEV_SEED_ANCHOR } from "./dev-seed";
import { withE2ePrisma } from "./e2e-db/prisma";
import { test as academicTest } from "./homework-fixture";

export const test = academicTest.extend<{
  pastExam: Exam;
  calendarUrl: string;
}>({
  pastExam: async ({ academic }, use) => {
    const exam = await withE2ePrisma((db) =>
      db.exam.create({
        data: {
          jwId: academic.section.jwId,
          sectionId: academic.section.id,
          examDate: new Date("2020-01-01T00:00:00Z"),
          startTime: 1300,
          endTime: 1400,
          examMode: "Closed book",
          examRooms: { create: { room: "Private exam room", count: 20 } },
        },
      }),
    );
    await use(exam);
  },
  calendarUrl: async ({ academic, page }, use) => {
    await withE2ePrisma((db) =>
      db.$transaction(async (tx) => {
        const group = await tx.scheduleGroup.create({
          data: {
            jwId: academic.section.jwId,
            sectionId: academic.section.id,
            no: 1,
            limitCount: 20,
            stdCount: 1,
            actualPeriods: 2,
            isDefault: true,
          },
        });
        await tx.schedule.create({
          data: {
            sectionId: academic.section.id,
            date: new Date(`${DEV_SEED_ANCHOR.date}T00:00:00Z`),
            scheduleGroupId: group.id,
            weekday: 3,
            startTime: 900,
            endTime: 1000,
            startUnit: 1,
            endUnit: 2,
            weekIndex: 8,
            periods: 2,
            customPlace: "Private teaching room",
          },
        });
        await tx.exam.create({
          data: {
            jwId: academic.section.jwId,
            sectionId: academic.section.id,
            examDate: new Date(`${DEV_SEED_ANCHOR.date}T00:00:00Z`),
            startTime: 1300,
            endTime: 1400,
            examMode: "Closed book",
          },
        });
      }),
    );
    try {
      await use(
        `/workspace/calendar?calendarSemester=${academic.section.semesterId}&snapshotAt=${encodeURIComponent(DEV_SEED_ANCHOR.recommendedAtTime)}`,
      );
    } finally {
      try {
        await page.close();
      } finally {
        await withE2ePrisma((db) =>
          db.$transaction([
            db.schedule.deleteMany({
              where: { sectionId: academic.section.id },
            }),
            db.scheduleGroup.deleteMany({
              where: { sectionId: academic.section.id },
            }),
          ]),
        );
      }
    }
  },
});
