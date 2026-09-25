import { describe, expect, it, vi } from "vitest";
import { toScheduleEntryDto } from "@/features/catalog/server/schedule-read-model";
import {
  type SubscribedScheduleRecord,
  toSubscribedScheduleEntryDto,
} from "@/features/subscriptions/server/subscription-schedule-exam-read-model";
import { schemaJsonResponse } from "@/lib/api/responses";
import {
  subscribedScheduleEntrySchema,
  subscribedSchedulesResponseSchema,
} from "@/lib/api/schemas/schedule-response-schema-core";
import { toLocalizedNameDto } from "@/lib/localized-name";

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: vi.fn(),
  prisma: {},
  withUserDbContext: vi.fn(),
}));

function scheduleRecord(): SubscribedScheduleRecord {
  const section = {
    ...Object.fromEntries(
      [
        "retiredAt",
        "bizTypeId",
        "credits",
        "period",
        "requiredWeeks",
        "catalogAdminClasses",
        "periodsPerWeek",
        "timesPerWeek",
        "stdCount",
        "limitCount",
        "graduateAndPostgraduate",
        "dateTimePlaceText",
        "dateTimePlacePersonText",
        "actualPeriods",
        "theoryPeriods",
        "practicePeriods",
        "experimentPeriods",
        "machinePeriods",
        "designPeriods",
        "testPeriods",
        "scheduleState",
        "suggestScheduleWeeks",
        "suggestScheduleWeekInfo",
        "scheduleJsonParams",
        "selectedStdCount",
        "remark",
        "scheduleRemark",
        "campusId",
        "examModeId",
        "openDepartmentId",
        "teachLanguageId",
        "roomTypeId",
      ].map((key) => [key, null]),
    ),
    id: 1,
    jwId: 101,
    code: "CS101.01",
    courseId: 2,
    semesterId: 3,
    course: {
      id: 2,
      jwId: 102,
      code: "CS101",
      nameCn: "课程",
      nameEn: "Course",
      categoryId: null,
      classTypeId: null,
      classifyId: null,
      educationLevelId: null,
      gradationId: null,
      typeId: null,
      internalMetadata: "must not leak",
    },
    semester: {
      id: 3,
      jwId: 103,
      code: "2026S",
      nameCn: "春",
      startDate: new Date("2026-03-01T00:00:00.000Z"),
      endDate: null,
    },
    internalMetadata: "must not leak",
  };
  return {
    id: 9,
    periods: 2,
    date: new Date("2026-04-29T00:00:00.000Z"),
    weekday: 3,
    startTime: 800,
    endTime: 930,
    experiment: null,
    customPlace: null,
    lessonType: null,
    weekIndex: 9,
    exerciseClass: false,
    startUnit: 1,
    endUnit: 2,
    roomId: null,
    sectionId: 1,
    scheduleGroupId: 7,
    room: null,
    section,
    teacherParticipations: [
      {
        periods: 2,
        exerciseClass: false,
        teacher: {
          id: 4,
          jwId: 104,
          personId: null,
          code: "T1",
          nameCn: "教师",
          nameEn: "Teacher",
          department: null,
          email: "private@example.test",
          teacherTitle: {
            id: 5,
            jwId: 105,
            code: "PROF",
            enabled: true,
            nameCn: "教授",
            nameEn: "Professor",
            internalMetadata: "must not leak",
          },
          _count: { sections: 8 },
        },
      },
    ],
    scheduleGroup: {
      id: 7,
      jwId: 107,
      no: 1,
      limitCount: 100,
      stdCount: 20,
      actualPeriods: 2,
      isDefault: true,
      sectionId: 1,
    },
    internalMetadata: "must not leak",
  } as unknown as SubscribedScheduleRecord;
}

// Previous composition: validate the base DTO before enriching and validating again.
function previouslyComposedDto(
  input: SubscribedScheduleRecord,
  locale: "en-us" | "zh-cn",
) {
  const schedule = toScheduleEntryDto(input, locale);
  const teachers = schedule.teachers.map((teacher, index) => {
    const source = input.teacherParticipations[index].teacher;
    return {
      ...teacher,
      teacherTitle: source.teacherTitle
        ? {
            id: source.teacherTitle.id,
            jwId: source.teacherTitle.jwId,
            code: source.teacherTitle.code,
            enabled: source.teacherTitle.enabled,
            ...toLocalizedNameDto(source.teacherTitle, locale),
          }
        : null,
      _count: { sections: source._count.sections },
    };
  });
  return subscribedScheduleEntrySchema.parse({
    ...schedule,
    teachers,
    teacherParticipations: schedule.teacherParticipations.map(
      (participation, index) => ({
        ...participation,
        teacher: teachers[index],
      }),
    ),
  });
}

describe("schedule DTO composition", () => {
  it.each(["en-us", "zh-cn"] as const)(
    "preserves the complete %s payload and input",
    (locale) => {
      const input = scheduleRecord();
      const original = structuredClone(input);
      const result = toSubscribedScheduleEntryDto(input, locale);
      expect(result).toEqual(previouslyComposedDto(input, locale));
      expect(result.date).toBe("2026-04-29T08:00:00+08:00");
      expect(result.section.semester?.startDate).toBe(
        "2026-03-01T08:00:00+08:00",
      );
      expect(result.teachers[0].namePrimary).toBe(
        locale === "en-us" ? "Teacher" : "教师",
      );
      expect(result.teacherParticipations[0].teacher).toEqual(
        result.teachers[0],
      );
      expect(JSON.stringify(result)).not.toContain("must not leak");
      expect(JSON.stringify(result)).not.toContain("private@example.test");
      expect(input).toEqual(original);
    },
  );

  it("keeps validation on both exported DTO mappers", () => {
    const input = scheduleRecord();
    input.periods = Number.NaN;
    expect(() => toScheduleEntryDto(input, "zh-cn")).toThrow();
    expect(() => toSubscribedScheduleEntryDto(input, "zh-cn")).toThrow();
    input.periods = 2;
    input.teacherParticipations[0].teacher._count.sections = 1.5;
    expect(() => toSubscribedScheduleEntryDto(input, "zh-cn")).toThrow();
  });

  it("keeps the strict final HTTP schema and wire payload", async () => {
    const schedule = toSubscribedScheduleEntryDto(scheduleRecord(), "en-us");
    const response = schemaJsonResponse(subscribedSchedulesResponseSchema, {
      schedules: [schedule],
    });
    expect(await response.json()).toEqual({ schedules: [schedule] });
    expect(() =>
      schemaJsonResponse(subscribedSchedulesResponseSchema, {
        schedules: [{ ...schedule, internalMetadata: "must not leak" }],
      }),
    ).toThrow();
  });
});
