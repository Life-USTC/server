import { describe, expect, it } from "vitest";
import { buildFullBusTimetable } from "@/lib/mcp/tools/bus-tool-summary";
import {
  getCalendarSubscriptionMutationPayload,
  getCalendarSubscriptionReadPayload,
} from "@/lib/mcp/tools/calendar-subscription-payload";
import { buildFullDashboardSnapshot } from "@/lib/mcp/tools/dashboard-summary";

describe("MCP full mode canonical shapes", () => {
  it("keeps dashboard collection wrappers and derived keys", () => {
    const deadline = { id: "deadline-1", rawField: true };
    const result = buildFullDashboardSnapshot({
      user: { id: "user-1", rawField: true },
      currentSemester: null,
      subscriptions: {
        totalCount: 0,
        currentSemesterCount: 0,
        currentSemesterSections: [],
      },
      nextClass: null,
      upcomingDeadlines: [deadline],
      upcomingEvents: [],
      todos: { incompleteCount: 1, items: [{ id: "todo-1" }] },
      bus: { preference: null, nextDeparture: null, departures: [] },
    } as never);

    expect(result.upcomingDeadlines).toEqual({
      total: 1,
      items: [deadline],
    });
    expect(result.upcomingEvents).toEqual({ total: 0, items: [] });
    expect(result.subscriptions.currentSemesterSectionsTotal).toBe(0);
    expect(result.bus.hasPreference).toBe(false);
  });

  it("adds raw bus data without dropping canonical default keys", () => {
    const result = buildFullBusTimetable({
      locale: "zh-cn",
      fetchedAt: "2026-04-01T08:00:00+08:00",
      version: null,
      campuses: [],
      routes: [],
      trips: [],
      availableVersions: [{ key: "v1" }],
      preferences: {
        preferredOriginCampusId: null,
        preferredDestinationCampusId: null,
        showDepartedTrips: false,
      },
      notice: null,
    } as never);

    expect(result.counts).toEqual({
      campuses: 0,
      routes: 0,
      weekdayTrips: 0,
      weekendTrips: 0,
    });
    expect(result.nextDepartures).toEqual([]);
    expect(result).toHaveProperty("nextDeparturesMessage");
    expect(result.availableVersions).toEqual([{ key: "v1" }]);
  });

  it("keeps calendar subscription counts when full adds raw sections", () => {
    const subscription = {
      userId: "user-1",
      sections: [],
      calendarPath: "/calendar.ics?token=secret",
      calendarUrl: "https://example.test/calendar.ics?token=secret",
      note: "test",
    } as never;

    const read = getCalendarSubscriptionReadPayload(subscription, "full");
    const mutation = getCalendarSubscriptionMutationPayload(
      subscription,
      "full",
    );

    expect(read).toMatchObject({
      sectionCount: 0,
      currentSemesterSectionCount: 0,
      currentSemesterSections: [],
      sections: [],
    });
    expect(mutation).toMatchObject({
      sectionCount: 0,
      currentSemesterSectionCount: 0,
      sections: [],
    });
  });
});
