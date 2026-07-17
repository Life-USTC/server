import { describe, expect, it } from "vitest";
import {
  mapCampusFromSection,
  mapSchedule,
  mapSection,
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
    startTime: 800,
    endTime: 940,
    customPlace: null,
    experiment: false,
    lessonType: "理论",
    weekIndex: 1,
    exerciseClass: false,
    startUnit: 1,
    endUnit: 2,
    ...overrides,
  };
}

describe("static schedule meeting mapping", () => {
  it("keeps otherwise identical meetings in different rooms separate", () => {
    const row = scheduleRow();

    expect(scheduleKey(row, 5301)).not.toBe(scheduleKey(row, 5302));
  });

  it("merges teachers only for the same room meeting", () => {
    const row = scheduleRow();
    const existing = mapSchedule(row, 11, 5301);

    mergeSchedule(existing, row, 12, 5301);

    expect(existing.teacherPersonIds).toEqual([11, 12]);
    expect(existing.roomJwId).toBe(5301);
  });

  it("refuses to merge teachers from different rooms", () => {
    const row = scheduleRow();

    expect(() =>
      mergeSchedule(mapSchedule(row, 11, 5301), row, 12, 5302),
    ).toThrow(/different rooms/);
  });

  it("uses the maximum teacher periods regardless of input order", () => {
    const shorter = scheduleRow({ periods: 3 });
    const longer = scheduleRow({ periods: 4 });
    const forward = mapSchedule(shorter, 11, 5301);
    const reverse = mapSchedule(longer, 12, 5301);

    mergeSchedule(forward, longer, 12, 5301);
    mergeSchedule(reverse, shorter, 11, 5301);

    expect(forward).toEqual(reverse);
    expect(forward.periods).toBe(4);
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
  it("builds a Campus from the JW campus ID and Catalog names", () => {
    expect(
      mapCampusFromSection(
        { campusId: 901 },
        { cn: "国际金融研究院", en: "International Institute" },
      ),
    ).toEqual({
      jwId: 901,
      nameCn: "国际金融研究院",
      nameEn: "International Institute",
    });
  });

  it("builds a name-only Campus when the JW lesson is missing", () => {
    expect(
      mapCampusFromSection(undefined, {
        cn: "国际金融研究院",
        en: "International Institute",
      }),
    ).toEqual({
      jwId: undefined,
      nameCn: "国际金融研究院",
      nameEn: "International Institute",
    });
  });

  it("retains the Catalog campus name when the JW lesson is missing", () => {
    const section = mapSection(
      { id: 1001, code: "MATH1001.01", semester_id: 401 },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        course: { id: 3001 },
        courseSourceKey: "course-source-key",
        campus: { cn: "国际金融研究院", en: "International Institute" },
      },
    );

    expect(section).toMatchObject({
      campusId: undefined,
      campusName: "国际金融研究院",
    });
  });
});
