import { afterAll, describe, expect, it } from "vitest";
import { buildScheduleListWhere } from "@/features/catalog/lib/schedule-filters";
import {
  sectionScheduleInclude,
  toSectionScheduleEntryDto,
} from "@/features/catalog/server/schedule-read-model";
import { compactSchedule } from "@/lib/mcp/compact-entities";
import { compactScheduleSchema } from "@/lib/mcp/tool-output-schemas/catalog-schemas";
import { createFixturePrisma, disconnectTestPrisma } from "../shared/prisma";

const prisma = createFixturePrisma();
afterAll(() => disconnectTestPrisma(prisma));

describe("schedule teacher participation", () => {
  it("retains legacy links with unknown facts and exposes different facts on one meeting", async () => {
    const rollback = new Error("ROLLBACK_SCHEDULE_PARTICIPATIONS");
    const marker = 2_129_000_000 + (Date.now() % 100_000);
    try {
      await prisma.$transaction(async (tx) => {
        const course = await tx.course.create({
          data: {
            jwId: marker,
            code: String(marker),
            nameCn: "[integration-test] shared meeting",
          },
        });
        const section = await tx.section.create({
          data: { jwId: marker, code: "TEST.01", courseId: course.id },
        });
        const group = await tx.scheduleGroup.create({
          data: {
            jwId: marker,
            sectionId: section.id,
            no: 1,
            stdCount: 0,
            limitCount: 0,
            actualPeriods: 2.5,
            isDefault: true,
          },
        });
        const schedule = await tx.schedule.create({
          data: {
            sectionId: section.id,
            scheduleGroupId: group.id,
            periods: 2.5,
            exerciseClass: null,
            weekday: 1,
            weekIndex: 1,
            startUnit: 1,
            endUnit: 3,
            startTime: 750,
            endTime: 1030,
          },
        });
        const first = await tx.teacher.create({
          data: { jwId: marker, nameCn: "同名教师", code: "PARTICIPANT-A" },
        });
        const second = await tx.teacher.create({
          data: { jwId: marker + 1, nameCn: "同名教师", code: "PARTICIPANT-B" },
        });
        // Existing physical links have no per-teacher facts to infer from the meeting.
        await tx.$executeRaw`INSERT INTO "_ScheduleTeachers" ("A", "B") VALUES (${schedule.id}, ${first.id})`;
        expect(
          await tx.scheduleTeacher.findUniqueOrThrow({
            where: {
              scheduleId_teacherId: {
                scheduleId: schedule.id,
                teacherId: first.id,
              },
            },
          }),
        ).toMatchObject({ periods: null, exerciseClass: null });
        await tx.scheduleTeacher.update({
          where: {
            scheduleId_teacherId: {
              scheduleId: schedule.id,
              teacherId: first.id,
            },
          },
          data: { periods: 2, exerciseClass: false },
        });
        await tx.scheduleTeacher.create({
          data: {
            scheduleId: schedule.id,
            teacherId: second.id,
            periods: 2.5,
            exerciseClass: true,
          },
        });
        const record = await tx.schedule.findUniqueOrThrow({
          where: { id: schedule.id },
          include: sectionScheduleInclude,
        });
        const dto = toSectionScheduleEntryDto(record, "zh-cn");
        expect(dto.teachers.map((teacher) => teacher.id)).toEqual([
          first.id,
          second.id,
        ]);
        expect(
          dto.teacherParticipations.map(
            ({ teacher, periods, exerciseClass }) => ({
              teacherId: teacher.id,
              periods,
              exerciseClass,
            }),
          ),
        ).toEqual([
          { teacherId: first.id, periods: 2, exerciseClass: false },
          { teacherId: second.id, periods: 2.5, exerciseClass: true },
        ]);
        expect(
          compactScheduleSchema.parse(compactSchedule(dto))
            .teacherParticipations,
        ).toHaveLength(2);
        expect(dto.exerciseClass).toBeNull();
        expect(
          await tx.schedule.count({ where: { sectionId: section.id } }),
        ).toBe(1);
        expect(
          await tx.schedule.count({
            where: buildScheduleListWhere({
              sectionId: section.id,
              teacherId: first.id,
            }),
          }),
        ).toBe(1);
        expect(
          await tx.schedule.count({
            where: buildScheduleListWhere({
              sectionId: section.id,
              teacherCode: second.code,
            }),
          }),
        ).toBe(1);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
