import { describe, expect, it } from "vitest";
import { overviewUpcomingExams } from "@/features/dashboard/lib/calendar-display-overview";

describe("dashboard overview exam display", () => {
  it("shows only exams that can still appear in the upcoming timeline", () => {
    const referenceDate = new Date("2026-05-22T10:30:00+08:00");
    const upcoming = overviewUpcomingExams(
      {
        allExams: [
          {
            id: "unknown-date",
            courseName: "Unknown",
            date: null,
          },
          {
            id: "ended",
            courseName: "Ended",
            date: "2026-05-22",
            startTime: 800,
            endTime: 1000,
          },
          {
            id: "untimed-today",
            courseName: "Untimed",
            date: "2026-05-22",
          },
          {
            id: "later-today",
            courseName: "Later",
            date: "2026-05-22",
            startTime: 1400,
          },
          {
            id: "future",
            courseName: "Future",
            date: "2026-05-23",
            startTime: 900,
          },
        ],
      },
      referenceDate,
    );

    expect(upcoming.map((exam) => exam.id)).toEqual([
      "later-today",
      "untimed-today",
      "future",
    ]);
  });
});
