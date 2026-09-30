import { describe, expect } from "vitest";
import { buildScheduleListWhere } from "@/features/catalog/lib/schedule-filters";
import {
  sectionScheduleInclude,
  toSectionScheduleEntryDto,
} from "@/features/catalog/server/schedule-read-model";
import { prisma } from "@/lib/db/prisma";
import { compactSchedule } from "@/lib/mcp/compact-entities";
import { compactScheduleSchema } from "@/lib/mcp/tool-output-schemas/catalog-schemas";
import { nodeProtocolTest as it } from "../shared/node-protocol-fixture";

describe("schedule teacher participation", () => {
  it("schedule.teacher-participation", async ({
    isolatedDatabase,
    protocolRuntime,
  }) => {
    await protocolRuntime.run(async () => {
      const marker = 2_129_000_000 + (Date.now() % 100_000);
      const { section, schedule, first, second, physicalLink } =
        await isolatedDatabase.owner.$transaction(async (tx) => {
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
            data: {
              jwId: marker + 1,
              nameCn: "同名教师",
              code: "PARTICIPANT-B",
            },
          });
          // Existing physical links have no per-teacher facts to infer from the meeting.
          await tx.$executeRaw`INSERT INTO "_ScheduleTeachers" ("A", "B") VALUES (${schedule.id}, ${first.id})`;
          const physicalLink = await tx.scheduleTeacher.findUniqueOrThrow({
            where: {
              scheduleId_teacherId: {
                scheduleId: schedule.id,
                teacherId: first.id,
              },
            },
          });
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
          return { section, schedule, first, second, physicalLink };
        });
      expect(physicalLink).toMatchObject({
        periods: null,
        exerciseClass: null,
      });
      await protocolRuntime.request(async () => {
        const record = await prisma.schedule.findUniqueOrThrow({
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
          await prisma.schedule.count({ where: { sectionId: section.id } }),
        ).toBe(1);
        expect(
          await prisma.schedule.count({
            where: buildScheduleListWhere({
              sectionId: section.id,
              teacherId: first.id,
            }),
          }),
        ).toBe(1);
        expect(
          await prisma.schedule.count({
            where: buildScheduleListWhere({
              sectionId: section.id,
              teacherCode: second.code,
            }),
          }),
        ).toBe(1);
      });
    });
  });
});
