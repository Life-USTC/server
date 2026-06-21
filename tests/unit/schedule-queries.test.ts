import { describe, expect, it } from "vitest";
import { buildScheduleListWhere } from "@/features/catalog/lib/schedule-filters";

describe("buildScheduleListWhere", () => {
  it("returns an empty where clause when no filters are given", () => {
    expect(buildScheduleListWhere({})).toEqual({});
  });

  it("applies sectionId as a direct field filter", () => {
    expect(buildScheduleListWhere({ sectionId: 42 })).toEqual({
      sectionId: 42,
    });
  });

  it("applies sectionJwId via nested section filter", () => {
    expect(buildScheduleListWhere({ sectionJwId: 9902001 })).toEqual({
      section: { jwId: 9902001 },
    });
  });

  it("applies sectionCode via nested section filter", () => {
    expect(buildScheduleListWhere({ sectionCode: "DEV-CS201.01" })).toEqual({
      section: { code: "DEV-CS201.01" },
    });
  });

  it("combines sectionJwId and sectionCode into one section filter", () => {
    expect(
      buildScheduleListWhere({ sectionJwId: 100, sectionCode: "CS101" }),
    ).toEqual({
      section: { jwId: 100, code: "CS101" },
    });
  });

  it("applies teacherId via teachers.some.id", () => {
    expect(buildScheduleListWhere({ teacherId: 7 })).toEqual({
      teachers: { some: { id: 7 } },
    });
  });

  it("applies teacherCode via teachers.some.code", () => {
    expect(buildScheduleListWhere({ teacherCode: "DEV-T-001" })).toEqual({
      teachers: { some: { code: "DEV-T-001" } },
    });
  });

  it("combines teacherId and teacherCode into one teachers.some filter", () => {
    expect(
      buildScheduleListWhere({ teacherId: 5, teacherCode: "T-001" }),
    ).toEqual({
      teachers: { some: { id: 5, code: "T-001" } },
    });
  });

  it("applies roomId as a direct field filter", () => {
    expect(buildScheduleListWhere({ roomId: 3 })).toEqual({ roomId: 3 });
  });

  it("applies roomJwId via nested room filter", () => {
    expect(buildScheduleListWhere({ roomJwId: 9910031 })).toEqual({
      room: { jwId: 9910031 },
    });
  });

  it("applies a dateFrom-only date range", () => {
    const from = new Date("2026-04-29T00:00:00.000Z");
    expect(buildScheduleListWhere({ dateFrom: from })).toEqual({
      date: { gte: from },
    });
  });

  it("applies a dateTo-only date range", () => {
    const to = new Date("2026-05-05T23:59:59.000Z");
    expect(buildScheduleListWhere({ dateTo: to })).toEqual({
      date: { lte: to },
    });
  });

  it("applies both dateFrom and dateTo as a range", () => {
    const from = new Date("2026-04-29T00:00:00.000Z");
    const to = new Date("2026-05-05T23:59:59.000Z");
    expect(buildScheduleListWhere({ dateFrom: from, dateTo: to })).toEqual({
      date: { gte: from, lte: to },
    });
  });

  it("applies weekday filter", () => {
    expect(buildScheduleListWhere({ weekday: 2 })).toEqual({ weekday: 2 });
  });

  it("ignores non-integer string inputs without producing a filter", () => {
    expect(buildScheduleListWhere({ sectionId: "abc" })).toEqual({});
    expect(buildScheduleListWhere({ sectionId: "42x" })).toEqual({});
    expect(buildScheduleListWhere({ weekday: "1.5" })).toEqual({});
    expect(buildScheduleListWhere({ teacherId: "" })).toEqual({});
    expect(buildScheduleListWhere({ roomId: null })).toEqual({});
    expect(buildScheduleListWhere({ weekday: undefined })).toEqual({});
  });

  it("parses string integer inputs correctly", () => {
    expect(buildScheduleListWhere({ sectionId: "42" })).toEqual({
      sectionId: 42,
    });
    expect(buildScheduleListWhere({ teacherId: "7" })).toEqual({
      teachers: { some: { id: 7 } },
    });
  });

  it("combines multiple independent filters", () => {
    const from = new Date("2026-04-29T00:00:00.000Z");
    const result = buildScheduleListWhere({
      sectionCode: "DEV-CS201.01",
      teacherCode: "DEV-T-001",
      roomJwId: 9910031,
      weekday: 2,
      dateFrom: from,
    });
    expect(result).toEqual({
      section: { code: "DEV-CS201.01" },
      teachers: { some: { code: "DEV-T-001" } },
      room: { jwId: 9910031 },
      weekday: 2,
      date: { gte: from },
    });
  });

  it("trims whitespace from teacherCode and sectionCode, ignores blank strings", () => {
    expect(buildScheduleListWhere({ teacherCode: "  " })).toEqual({});
    expect(buildScheduleListWhere({ sectionCode: "  " })).toEqual({});
    expect(buildScheduleListWhere({ teacherCode: "  T-001  " })).toEqual({
      teachers: { some: { code: "T-001" } },
    });
  });
});
