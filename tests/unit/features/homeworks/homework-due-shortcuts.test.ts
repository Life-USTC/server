import { describe, expect, it } from "vitest";
import {
  buildHomeworkDueShortcuts,
  nextHomeworkClassStarts,
} from "@/features/homeworks/lib/homework-due-shortcuts";

const copy = {
  helperBeforeMonday: "BEFORE MONDAY · {date}",
  helperNextClass: "NEXT CLASS · {date}",
  helperNextWeek: "NEXT {weekday} · {date}",
  helperThisWeek: "THIS {weekday} · {date}",
};

describe("homework due shortcuts", () => {
  it("keeps actual class starts and weekly deadlines in Shanghai time", () => {
    const result = buildHomeworkDueShortcuts({
      classStarts: ["2026-09-11T01:00:00+08:00"],
      copy,
      locale: "en-us",
      now: "2026-09-10T15:30:00.000Z",
    });

    expect(result.slice(0, 2).map((shortcut) => shortcut.value)).toEqual([
      "2026-09-11T01:00",
      "2026-09-11T23:59",
    ]);
    expect(result[0]?.label).toMatch(/^NEXT CLASS · /);
    expect(result[1]?.label).toMatch(/^THIS Fri · /);
  });

  it("rolls weekly deadlines across the year boundary", () => {
    const result = buildHomeworkDueShortcuts({
      copy,
      locale: "en-us",
      now: "2026-12-27T15:30:00.000Z",
    });

    expect(result.map((shortcut) => shortcut.value)).toEqual([
      "2026-12-27T23:59",
      "2026-12-28T00:00",
      "2027-01-01T23:59",
      "2027-01-02T23:59",
      "2027-01-03T23:59",
      "2027-01-04T00:00",
    ]);
    expect(result[1]?.label).toMatch(/^BEFORE MONDAY · /);
    expect(result[2]?.label).toMatch(/^NEXT Fri · /);
  });

  it("omits past and duplicate class starts while retaining only three actual classes", () => {
    const result = nextHomeworkClassStarts(
      [
        { date: "2026-09-09", startTime: 900 },
        { date: "2026-09-11", startTime: 900 },
        { date: "2026-09-11", startTime: 900 },
        { date: "2026-09-12", startTime: 1000 },
        { date: null, startTime: 1100 },
        { date: "2026-09-13", startTime: 1100 },
        { date: "2026-09-14", startTime: 1200 },
      ],
      "2026-09-10T02:00:00.000Z",
    );

    expect(result).toEqual([
      "2026-09-11T09:00:00+08:00",
      "2026-09-12T10:00:00+08:00",
      "2026-09-13T11:00:00+08:00",
    ]);
  });

  it("selects the next class starts before the common deadlines", () => {
    const result = buildHomeworkDueShortcuts({
      classStarts: [
        "2026-09-12T10:00:00+08:00",
        "2026-09-11T09:00:00+08:00",
        "2026-09-11T09:00:00+08:00",
        "2026-09-14T09:00:00+08:00",
      ],
      copy,
      locale: "zh-cn",
      now: "2026-09-10T10:00:00+08:00",
    });

    expect(result.slice(0, 3).map((shortcut) => shortcut.value)).toEqual([
      "2026-09-11T09:00",
      "2026-09-12T10:00",
      "2026-09-14T09:00",
    ]);
    expect(
      result
        .slice(0, 3)
        .every((shortcut) => shortcut.label.startsWith("NEXT CLASS · ")),
    ).toBe(true);
  });

  it("drops weekly deadlines that are already past", () => {
    const result = buildHomeworkDueShortcuts({
      copy,
      locale: "en-us",
      now: "2026-09-11T16:00:00.000Z",
    });

    expect(result.map((shortcut) => shortcut.value)).toEqual([
      "2026-09-12T23:59",
      "2026-09-13T23:59",
      "2026-09-14T00:00",
      "2026-09-18T23:59",
      "2026-09-19T23:59",
      "2026-09-20T23:59",
      "2026-09-21T00:00",
    ]);
    expect(
      result.some((shortcut) => shortcut.value === "2026-09-11T23:59"),
    ).toBe(false);
  });
});
