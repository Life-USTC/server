import type { Exam } from "../../../src/generated/prisma-node/client";
import { DEV_SEED_ANCHOR } from "./dev-seed";
import { test as academicTest } from "./homework-fixture";

export const test = academicTest.extend<{
  pastExam: Exam;
  calendarUrl: string;
}>({
  pastExam: async ({ academic, academicDb }, use) => {
    const exam = await academicDb((db) =>
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
  calendarUrl: async ({ academic, academicDb, semesters }, use) => {
    await academicDb((db) =>
      db.$transaction(async (tx) => {
        // Calendar events and snapshotAt share this fixed, bounded semester.
        await tx.semester.update({
          where: { id: semesters.current.id },
          data: {
            startDate: new Date("2026-04-08T00:00:00Z"),
            endDate: new Date("2026-09-06T00:00:00Z"),
          },
        });
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
    await use(
      `/workspace/calendar?calendarSemester=${academic.section.semesterId}&snapshotAt=${encodeURIComponent(DEV_SEED_ANCHOR.recommendedAtTime)}`,
    );
  },
});
