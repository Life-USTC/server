import { describe, expect, it } from "vitest";
import {
  mapCampus,
  mapCampusFromSection,
  mapSchedule,
  mapScheduleGroup,
  mapSection,
  mapTeacherAssignment,
  mergeSchedule,
  scheduleKey,
} from "@/static-loader/mappers";
import type { SnapshotRow } from "@/static-loader/snapshot-values";

function scheduleRow(overrides: SnapshotRow = {}): SnapshotRow {
  return {
    lessonId: 1001,
    scheduleGroupId: 2001,
    periods: 2,
    date: "2026-09-01",
    weekday: 2,
    startTime: 750,
    endTime: 925,
    customPlace: null,
    experiment: false,
    lessonType: "理论",
    weekIndex: 1,
    exerciseClass: false,
    startUnit: 0,
    endUnit: 0,
    ...overrides,
  };
}

describe("static schedule meeting mapping", () => {
  it("keeps otherwise identical meetings in different rooms separate", () => {
    const row = scheduleRow();

    expect(scheduleKey(row, 5301)).not.toBe(scheduleKey(row, 5302));
  });

  it("does not use derived units as part of meeting identity", () => {
    expect(scheduleKey(scheduleRow({ startUnit: 0, endUnit: 0 }), 5301)).toBe(
      scheduleKey(scheduleRow({ startUnit: 1, endUnit: 2 }), 5301),
    );
  });

  it.each([
    [750, 835, 1, 1],
    [840, 925, 2, 2],
    [945, 1030, 3, 3],
    [1035, 1120, 4, 4],
    [1125, 1210, 5, 5],
    [1400, 1445, 6, 6],
    [1450, 1535, 7, 7],
    [1555, 1640, 8, 8],
    [1645, 1730, 9, 9],
    [1735, 1820, 10, 10],
    [1930, 2015, 11, 11],
    [2020, 2105, 12, 12],
    [2110, 2155, 13, 13],
    [750, 925, 1, 2],
    [945, 1120, 3, 4],
    [1400, 1535, 6, 7],
    [1555, 1730, 8, 9],
    [1930, 2155, 11, 13],
  ])(
    "derives %i-%i as units %i-%i from exact timetable boundaries",
    (startTime, endTime, startUnit, endUnit) => {
      expect(mapSchedule(scheduleRow({ startTime, endTime }))).toMatchObject({
        startUnit,
        endUnit,
      });
    },
  );

  it.each([
    [830, 925],
    [750, 1200],
    [1400, 1745],
    [1250, 1250],
    [2110, 835],
  ])(
    "leaves custom or invalid time %i-%i without units",
    (startTime, endTime) => {
      expect(
        mapSchedule(
          scheduleRow({ startTime, endTime, startUnit: 7, endUnit: 8 }),
        ),
      ).toMatchObject({ startUnit: 0, endUnit: 0 });
    },
  );

  it("merges teachers only for the same room meeting", () => {
    const row = scheduleRow();
    const existing = mapSchedule(row, 11, 5301);

    mergeSchedule(existing, row, 12, 5301);

    expect(existing.teacherJwIds).toEqual([11, 12]);
    expect(existing.roomJwId).toBe(5301);
  });

  it("refuses to merge teachers from different rooms", () => {
    const row = scheduleRow();

    expect(() =>
      mergeSchedule(mapSchedule(row, 11, 5301), row, 12, 5302),
    ).toThrow(/different rooms/);
  });

  it("uses the maximum teacher periods regardless of input order", () => {
    const shorter = scheduleRow({ periods: 2.5 });
    const longer = scheduleRow({ periods: 4 });
    const forward = mapSchedule(shorter, 11, 5301);
    const reverse = mapSchedule(longer, 12, 5301);

    mergeSchedule(forward, longer, 12, 5301);
    mergeSchedule(reverse, shorter, 11, 5301);

    expect(forward).toEqual(reverse);
    expect(forward.periods).toBe(4);
  });

  it("preserves fractional periods and nullable exerciseClass", () => {
    expect(
      mapSchedule(scheduleRow({ periods: 2.5, exerciseClass: null })),
    ).toMatchObject({ periods: 2.5, exerciseClass: undefined });
  });

  it("preserves large fractional schedule and group periods", () => {
    expect(mapSchedule(scheduleRow({ periods: 39.5 }))).toMatchObject({
      periods: 39.5,
    });
    expect(
      mapScheduleGroup({
        id: 2001,
        lessonId: 1001,
        no: 1,
        limitCount: 100,
        stdCount: 80,
        actualPeriods: 39.5,
        default: true,
      }),
    ).toMatchObject({ actualPeriods: 39.5 });
  });

  it.each([
    ["experiment", { experiment: true }],
    ["lessonType", { lessonType: "实验" }],
    ["exerciseClass", { exerciseClass: true }],
  ])("rejects conflicting %s regardless of input order", (_field, conflict) => {
    const first = scheduleRow();
    const second = scheduleRow(conflict);

    expect(() =>
      mergeSchedule(mapSchedule(first, 11, 5301), second, 12, 5301),
    ).toThrow(/Conflicting schedule/);
    expect(() =>
      mergeSchedule(mapSchedule(second, 12, 5301), first, 11, 5301),
    ).toThrow(/Conflicting schedule/);
  });

  it("uses the defined optional payload regardless of input order", () => {
    const withoutOptional = scheduleRow({
      experiment: null,
      lessonType: null,
      exerciseClass: null,
    });
    const withOptional = scheduleRow({
      experiment: true,
      lessonType: "理论",
      exerciseClass: false,
    });

    const forward = mapSchedule(withoutOptional, 12, 5301);
    mergeSchedule(forward, withOptional, 11, 5301);
    const reverse = mapSchedule(withOptional, 11, 5301);
    mergeSchedule(reverse, withoutOptional, 12, 5301);

    expect(forward).toEqual(reverse);
  });

  it("treats null and false exerciseClass as the same false value", () => {
    const row = scheduleRow({ exerciseClass: null });
    const existing = mapSchedule(row, 11, 5301);

    expect(() =>
      mergeSchedule(existing, scheduleRow({ exerciseClass: false }), 12, 5301),
    ).not.toThrow();
    expect(existing.exerciseClass).toBe(false);
  });
});

describe("static section campus mapping", () => {
  it("preserves fractional weekly and actual periods", () => {
    expect(
      mapSection(
        {
          id: 1001,
          code: "MATH1001.01",
          semester_id: 401,
          periodsPerWeek: 2.5,
          actualPeriods: 39.5,
        },
        { actualPeriods: 39.5 },
        undefined,
        undefined,
        undefined,
        undefined,
        { course: { id: 3001 } },
      ),
    ).toMatchObject({ periodsPerWeek: 2.5, actualPeriods: 39.5 });
  });

  it("maps only JW Campus entities that carry an upstream id", () => {
    expect(
      mapCampus({ id: 901, nameZh: "东校区", nameEn: "East Campus" }),
    ).toEqual({
      jwId: 901,
      nameCn: "东校区",
      nameEn: "East Campus",
      code: undefined,
    });
    expect(mapCampus({ nameZh: "无 ID 校区" })).toBeUndefined();
    expect(
      mapCampusFromSection(
        { campusId: 23 },
        { cn: "融合学院", en: "Fusion College" },
      ),
    ).toEqual({
      jwId: 23,
      nameCn: "融合学院",
      nameEn: "Fusion College",
    });
    expect(mapCampusFromSection(undefined, { cn: "只有名称" })).toBeUndefined();
  });

  it("uses scheduleLesson.campusId only as the Section foreign key", () => {
    const section = mapSection(
      { id: 1001, code: "MATH1001.01", semester_id: 401 },
      { campusId: 901 },
      undefined,
      undefined,
      undefined,
      undefined,
      {
        course: { id: 3001 },
      },
    );

    expect(section).toMatchObject({
      campusId: 901,
    });
  });
});

describe("static teacher assignment mapping", () => {
  it("keeps title identity on the assignment edge", () => {
    expect(
      mapTeacherAssignment(1001, { teacherId: 20, name: "张三" }, [], 30, 40),
    ).toMatchObject({
      sectionJwId: 1001,
      teacherJwId: 20,
      teacherLessonTypeId: 30,
      teacherTitleJwId: 40,
    });
  });

  it("preserves fractional teacher periods", () => {
    expect(
      mapTeacherAssignment(
        1001,
        { teacherId: 20, name: "张三", period: 0.5 },
        [],
      ),
    ).toMatchObject({ period: 0.5 });
  });
});
