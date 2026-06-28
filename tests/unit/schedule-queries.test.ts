import { describe, expect, it } from "vitest";
import { buildScheduleListWhere } from "@/features/catalog/lib/schedule-filters";

describe("buildScheduleListWhere", () => {
  it("无过滤条件时返回空 where 子句", () => {
    expect(buildScheduleListWhere({})).toEqual({});
  });

  it("将 sectionId 作为直接字段过滤", () => {
    expect(buildScheduleListWhere({ sectionId: 42 })).toEqual({
      sectionId: 42,
    });
  });

  it("通过嵌套 section 过滤应用 sectionJwId", () => {
    expect(buildScheduleListWhere({ sectionJwId: 9902001 })).toEqual({
      section: { jwId: 9902001 },
    });
  });

  it("通过嵌套 section 过滤应用 sectionCode", () => {
    expect(buildScheduleListWhere({ sectionCode: "DEV-CS201.01" })).toEqual({
      section: { code: "DEV-CS201.01" },
    });
  });

  it("将 sectionJwId 和 sectionCode 合并为一个 section 过滤", () => {
    expect(
      buildScheduleListWhere({ sectionJwId: 100, sectionCode: "CS101" }),
    ).toEqual({
      section: { jwId: 100, code: "CS101" },
    });
  });

  it("通过 teachers.some.id 应用 teacherId", () => {
    expect(buildScheduleListWhere({ teacherId: 7 })).toEqual({
      teachers: { some: { id: 7 } },
    });
  });

  it("通过 teachers.some.code 应用 teacherCode", () => {
    expect(buildScheduleListWhere({ teacherCode: "DEV-T-001" })).toEqual({
      teachers: { some: { code: "DEV-T-001" } },
    });
  });

  it("将 teacherId 和 teacherCode 合并为一个 teachers.some 过滤", () => {
    expect(
      buildScheduleListWhere({ teacherId: 5, teacherCode: "T-001" }),
    ).toEqual({
      teachers: { some: { id: 5, code: "T-001" } },
    });
  });

  it("将 roomId 作为直接字段过滤", () => {
    expect(buildScheduleListWhere({ roomId: 3 })).toEqual({ roomId: 3 });
  });

  it("通过嵌套 room 过滤应用 roomJwId", () => {
    expect(buildScheduleListWhere({ roomJwId: 9910031 })).toEqual({
      room: { jwId: 9910031 },
    });
  });

  it("仅使用 dateFrom 的日期范围", () => {
    const from = new Date("2026-04-29T00:00:00.000Z");
    expect(buildScheduleListWhere({ dateFrom: from })).toEqual({
      date: { gte: from },
    });
  });

  it("仅使用 dateTo 的日期范围", () => {
    const to = new Date("2026-05-05T23:59:59.000Z");
    expect(buildScheduleListWhere({ dateTo: to })).toEqual({
      date: { lte: to },
    });
  });

  it("同时使用 dateFrom 和 dateTo 作为范围", () => {
    const from = new Date("2026-04-29T00:00:00.000Z");
    const to = new Date("2026-05-05T23:59:59.000Z");
    expect(buildScheduleListWhere({ dateFrom: from, dateTo: to })).toEqual({
      date: { gte: from, lte: to },
    });
  });

  it("应用 weekday 过滤", () => {
    expect(buildScheduleListWhere({ weekday: 2 })).toEqual({ weekday: 2 });
  });

  it("忽略非整数字符串输入，不生成过滤", () => {
    expect(buildScheduleListWhere({ sectionId: "abc" })).toEqual({});
    expect(buildScheduleListWhere({ sectionId: "42x" })).toEqual({});
    expect(buildScheduleListWhere({ weekday: "1.5" })).toEqual({});
    expect(buildScheduleListWhere({ teacherId: "" })).toEqual({});
    expect(buildScheduleListWhere({ roomId: null })).toEqual({});
    expect(buildScheduleListWhere({ weekday: undefined })).toEqual({});
  });

  it("正确解析字符串形式的整数输入", () => {
    expect(buildScheduleListWhere({ sectionId: "42" })).toEqual({
      sectionId: 42,
    });
    expect(buildScheduleListWhere({ teacherId: "7" })).toEqual({
      teachers: { some: { id: 7 } },
    });
  });

  it("组合多个独立过滤条件", () => {
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

  it("去除 teacherCode 和 sectionCode 的空白并忽略空字符串", () => {
    expect(buildScheduleListWhere({ teacherCode: "  " })).toEqual({});
    expect(buildScheduleListWhere({ sectionCode: "  " })).toEqual({});
    expect(buildScheduleListWhere({ teacherCode: "  T-001  " })).toEqual({
      teachers: { some: { code: "T-001" } },
    });
  });
});
