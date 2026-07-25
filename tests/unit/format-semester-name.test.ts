import { describe, expect, test } from "vitest";
import { formatSemesterName } from "@/lib/text/format-semester-name";

describe("formatSemesterName", () => {
  test.each([
    ["en-us", "2026年春季学期", "Spring 2026"],
    ["en-us", "2025年秋季学期", "Fall 2025"],
    ["zh-cn", "2026年春季学期", "2026年春季学期"],
    ["zh-cn", "2025年秋季学期", "2025年秋季学期"],
    ["en-us", "2026年夏季学期", "2026年夏季学期"],
    ["en-us", "2026年春季", "2026年春季"],
    ["en-us", "未知学期", "未知学期"],
    ["en-us", " 2026年春季学期 ", "Spring 2026"],
  ])("formatSemesterName(%s, %s) = %s", (locale, nameCn, expected) => {
    expect(formatSemesterName(locale, nameCn)).toBe(expected);
  });
});
