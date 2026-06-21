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

describe("current-semester helpers", () => {
  it("builds date range where clause", () => {
    const now = new Date("2026-09-01T00:00:00.000Z");
    expect(buildCurrentSemesterWhere(now)).toEqual({
      startDate: { lte: now },
      endDate: { gte: now },
    });
  });

  it("prefers first unfinished semester", () => {
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

  it("prefers the latest-starting semester when ranges overlap", () => {
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

  it("falls back to earliest unfinished future semester", () => {
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

  it("falls back to latest semester when all semesters are finished", () => {
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
