import { describe, expect, it } from "vitest";
import {
  summarizeCalendarSubscription,
  summarizeCalendarSubscriptionBrief,
} from "@/lib/mcp/tools/calendar-summary";

describe("summarizeCalendarSubscription 日历订阅摘要", () => {
  it("将缺少边界的学期视为开放式", () => {
    const input = {
      userId: "user-1",
      sections: [
        {
          id: 1,
          jwId: 101,
          code: "CS101.01",
          course: {
            jwId: 201,
            code: "CS101",
            namePrimary: "Intro to CS",
            nameSecondary: "计算机导论",
          },
          semester: {
            id: 301,
            jwId: 401,
            code: "2026-SPRING",
            nameCn: "2026春",
            startDate: null,
            endDate: null,
          },
        },
        {
          id: 2,
          jwId: 102,
          code: "CS102.01",
          course: {
            jwId: 202,
            code: "CS102",
            namePrimary: "Data Structures",
            nameSecondary: "数据结构",
          },
          semester: {
            id: 302,
            jwId: 402,
            code: "2026-SPRING",
            nameCn: "2026春",
            startDate: "2026-01-01T00:00:00.000Z",
            endDate: null,
          },
        },
      ],
      calendarPath: "/api/users/user-1/calendar.ics?token=secret",
      calendarUrl:
        "https://life.example/api/users/user-1/calendar.ics?token=secret",
      note: "note",
    };
    const summary = summarizeCalendarSubscription(input);
    const brief = summarizeCalendarSubscriptionBrief(input);

    expect(summary.sectionCount).toBe(2);
    expect(summary.currentSemesterSectionCount).toBe(2);
    expect(summary.currentSemesterSections).toHaveLength(2);
    expect(summary.calendarPath).toContain("/api/users/user-1/calendar.ics");
    expect(summary.calendarUrl).toContain("/api/users/user-1/calendar.ics");
    expect(brief).not.toHaveProperty("currentSemesterSections");
    expect(brief.sectionCount).toBe(2);
    expect(brief.calendarPath).toContain("/api/users/user-1/calendar.ics");
  });
});
