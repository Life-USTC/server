import { describe, expect, test } from "vitest";
import { parseDateInput } from "@/lib/time/parse-date-input";

describe("parseDateInput", () => {
  test("空值返回 null", () => {
    expect(parseDateInput(undefined)).toBeNull();
    expect(parseDateInput(null)).toBeNull();
    expect(parseDateInput("   ")).toBeNull();
  });

  test("按原样解析显式时区输入", () => {
    const parsed = parseDateInput("2026-03-26T12:00:00+08:00");
    expect(parsed?.toISOString()).toBe("2026-03-26T04:00:00.000Z");
  });

  test("将无时区日期时间按 Asia/Shanghai 解析", () => {
    const parsed = parseDateInput("2026-03-26T12:00");
    expect(parsed?.toISOString()).toBe("2026-03-26T04:00:00.000Z");
  });

  test("将仅日期字符串视为 UTC 午夜", () => {
    const parsed = parseDateInput("2026-03-26");
    expect(parsed?.toISOString()).toBe("2026-03-26T00:00:00.000Z");
  });

  test("无效输入返回 undefined", () => {
    expect(parseDateInput("not-a-date")).toBeUndefined();
  });

  test("拒绝溢出的日历日期", () => {
    expect(parseDateInput("2026-02-31")).toBeUndefined();
    expect(parseDateInput("2026-13-01")).toBeUndefined();
    expect(parseDateInput("2026-02-31T12:00")).toBeUndefined();
    expect(parseDateInput("2026-02-31T12:00:00Z")).toBeUndefined();
    expect(parseDateInput("2026-02-31T12:00:00+08:00")).toBeUndefined();
    expect(parseDateInput("2026-2-31")).toBeUndefined();
    expect(parseDateInput("2026/02/31")).toBeUndefined();
    expect(parseDateInput("2026.02.31")).toBeUndefined();
    expect(parseDateInput("02/31/2026")).toBeUndefined();
    expect(parseDateInput("2/31/2026")).toBeUndefined();
    expect(parseDateInput("02.31.2026")).toBeUndefined();
    expect(parseDateInput("February 31, 2026")).toBeUndefined();
  });

  test("拒绝不支持的日期格式", () => {
    expect(parseDateInput("03/26/2026")).toBeUndefined();
    expect(parseDateInput("February 28, 2026")).toBeUndefined();
  });
});
