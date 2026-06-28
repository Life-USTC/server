import { describe, expect, it } from "vitest";
import { formatSmartDate, formatSmartDateTime } from "@/shared/lib/time-utils";

describe("formatSmartDateTime", () => {
  it("同一日历日显示为今天（zh）", () => {
    const ref = new Date("2026-03-17T10:00:00+08:00");
    const due = new Date("2026-03-17T23:00:00+08:00");
    expect(formatSmartDateTime(due, ref, "zh-cn")).toBe("今天 23:00");
  });

  it("使用基于周一的同一周标签跨共享 week helper", () => {
    const ref = new Date("2026-03-16T10:00:00+08:00");
    const due = new Date("2026-03-22T09:00:00+08:00");
    expect(formatSmartDateTime(due, ref, "en-us")).toBe("Sun, 09:00");
  });

  it("不将上周日视为本周", () => {
    const ref = new Date("2026-03-18T10:00:00+08:00");
    const due = new Date("2026-03-15T09:00:00+08:00");
    expect(formatSmartDateTime(due, ref, "zh-cn")).toBe("3月15日 09:00");
  });

  it("同一年但不同周时省略年份（zh）", () => {
    const ref = new Date("2026-03-17T10:00:00+08:00");
    const due = new Date("2026-04-20T15:30:00+08:00");
    expect(formatSmartDateTime(due, ref, "zh-cn")).toBe("4月20日 15:30");
  });

  it("与参考年份不同时包含年份（zh）", () => {
    const ref = new Date("2026-03-17T10:00:00+08:00");
    const due = new Date("2025-12-01T09:00:00+08:00");
    expect(formatSmartDateTime(due, ref, "zh-cn")).toBe("2025年12月1日 09:00");
  });
});

describe("formatSmartDate", () => {
  it("仅日期时显示今天（zh）", () => {
    const ref = new Date("2026-03-17T10:00:00+08:00");
    const due = new Date("2026-03-17T08:00:00+08:00");
    expect(formatSmartDate(due, ref, "zh-cn")).toBe("今天");
  });

  it("复用相同的基于周一的周边界", () => {
    const ref = new Date("2026-03-16T10:00:00+08:00");
    const due = new Date("2026-03-22T08:00:00+08:00");
    expect(formatSmartDate(due, ref, "en-us")).toBe("Sunday");
  });

  it("同一年但不同周时省略年份（zh）", () => {
    const ref = new Date("2026-03-17T10:00:00+08:00");
    const due = new Date("2026-04-20T15:30:00+08:00");
    expect(formatSmartDate(due, ref, "zh-cn")).toBe("4月20日");
  });

  it("与参考年份不同时包含年份（zh）", () => {
    const ref = new Date("2026-03-17T10:00:00+08:00");
    const due = new Date("2025-12-01T09:00:00+08:00");
    expect(formatSmartDate(due, ref, "zh-cn")).toBe("2025年12月1日");
  });
});
