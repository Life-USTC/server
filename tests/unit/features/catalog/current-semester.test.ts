import { describe, expect, it } from "vitest";
import {
  buildCurrentSemesterWhere,
  currentSemesterDateKey,
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

  it("按上海自然日归一化查询日期并生成缓存键", () => {
    const lateOnEndDate = new Date("2026-08-14T15:59:59.000Z");
    const dateOnly = new Date("2026-08-14T00:00:00.000Z");

    expect(buildCurrentSemesterWhere(lateOnEndDate)).toEqual({
      startDate: { lte: dateOnly },
      endDate: { gte: dateOnly },
    });
    expect(currentSemesterDateKey(lateOnEndDate)).toBe("2026-08-14");
  });

  it("上海午夜后切换到新的查询日期和缓存键", () => {
    const afterMidnight = new Date("2026-08-14T16:00:00.000Z");
    const dateOnly = new Date("2026-08-15T00:00:00.000Z");

    expect(buildCurrentSemesterWhere(afterMidnight)).toEqual({
      startDate: { lte: dateOnly },
      endDate: { gte: dateOnly },
    });
    expect(currentSemesterDateKey(afterMidnight)).toBe("2026-08-15");
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

  it("不会将未来学期推断为当前学期", () => {
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

    expect(selectCurrentSemesterFromList(semesters, referenceDate)).toBeNull();
  });

  it("所有学期结束后不存在当前学期", () => {
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

    expect(selectCurrentSemesterFromList(semesters, referenceDate)).toBeNull();
  });
  it("缺少日期范围的学期不会伪装为当前学期", () => {
    const referenceDate = new Date("2026-06-01T00:00:00.000Z");
    expect(
      selectCurrentSemesterFromList(
        [
          { id: 1, startDate: null, endDate: null },
          {
            id: 2,
            startDate: new Date("2026-01-01T00:00:00.000Z"),
            endDate: null,
          },
          {
            id: 3,
            startDate: null,
            endDate: new Date("2026-12-01T00:00:00.000Z"),
          },
        ],
        referenceDate,
      ),
    ).toBeNull();
  });

  it("列表选择和数据库查询均包含上海学期结束日的全部时间", () => {
    const semesters = [
      {
        id: 1,
        startDate: new Date("2026-02-01T00:00:00.000Z"),
        endDate: new Date("2026-08-14T00:00:00.000Z"),
      },
    ];
    expect(
      selectCurrentSemesterFromList(
        semesters,
        new Date("2026-08-14T15:59:59.000Z"),
      )?.id,
    ).toBe(1);
    expect(
      selectCurrentSemesterFromList(
        semesters,
        new Date("2026-08-14T16:00:00.000Z"),
      ),
    ).toBeNull();
  });
});
