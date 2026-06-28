import { describe, expect, it } from "vitest";
import {
  buildCurrentSemesterWhere,
  selectCurrentSemesterFromList,
} from "@/features/catalog/lib/current-semester";

type SemesterLike = {
  id: number;
  startDate: Date | null;
  endDate: Date | null;
};

describe("当前学期辅助函数", () => {
  it("构建日期范围 where 子句", () => {
    const now = new Date("2026-09-01T00:00:00.000Z");
    expect(buildCurrentSemesterWhere(now)).toEqual({
      startDate: { lte: now },
      endDate: { gte: now },
    });
  });

  it("优先选择第一个未结束学期", () => {
    const referenceDate = new Date("2026-03-15T00:00:00.000Z");
    const semesters: SemesterLike[] = [
      {
        id: 1,
        startDate: new Date("2025-09-01T00:00:00.000Z"),
        endDate: new Date("2026-01-31T00:00:00.000Z"),
      },
      {
        id: 2,
        startDate: new Date("2026-02-15T00:00:00.000Z"),
        endDate: new Date("2026-07-10T00:00:00.000Z"),
      },
      {
        id: 3,
        startDate: new Date("2026-09-01T00:00:00.000Z"),
        endDate: new Date("2027-01-31T00:00:00.000Z"),
      },
    ];

    expect(selectCurrentSemesterFromList(semesters, referenceDate)?.id).toBe(2);
  });

  it("当日期范围重叠时优先选择开始时间最晚的学期", () => {
    const referenceDate = new Date("2026-04-15T00:00:00.000Z");
    const semesters: SemesterLike[] = [
      {
        id: 1,
        startDate: new Date("2026-02-15T00:00:00.000Z"),
        endDate: new Date("2026-07-10T00:00:00.000Z"),
      },
      {
        id: 2,
        startDate: new Date("2026-04-01T00:00:00.000Z"),
        endDate: new Date("2026-08-31T00:00:00.000Z"),
      },
    ];

    expect(selectCurrentSemesterFromList(semesters, referenceDate)?.id).toBe(2);
  });

  it("回退到最早的未开始未来学期", () => {
    const referenceDate = new Date("2026-01-01T00:00:00.000Z");
    const semesters: SemesterLike[] = [
      {
        id: 10,
        startDate: new Date("2026-03-01T00:00:00.000Z"),
        endDate: new Date("2026-07-01T00:00:00.000Z"),
      },
      {
        id: 11,
        startDate: new Date("2026-09-01T00:00:00.000Z"),
        endDate: new Date("2027-01-01T00:00:00.000Z"),
      },
    ];

    expect(selectCurrentSemesterFromList(semesters, referenceDate)?.id).toBe(
      10,
    );
  });

  it("当所有学期都已结束时回退到最晚学期", () => {
    const referenceDate = new Date("2026-02-01T12:00:00.000Z");
    const semesters: SemesterLike[] = [
      {
        id: 20,
        startDate: new Date("2024-09-01T00:00:00.000Z"),
        endDate: new Date("2025-01-31T23:59:59.000Z"),
      },
      {
        id: 21,
        startDate: new Date("2025-02-01T00:00:00.000Z"),
        endDate: new Date("2025-06-30T23:59:59.000Z"),
      },
    ];

    expect(selectCurrentSemesterFromList(semesters, referenceDate)?.id).toBe(
      21,
    );
  });
});
