import {
  compactDashboardUser,
  summarizeDashboardBusDeparture,
  summarizeDashboardCalendarEvent,
  summarizeDashboardCurrentSemester,
} from "./dashboard-summary-common";
import type { DashboardSnapshot } from "./dashboard-summary-types";

export function summarizeDashboardSnapshot(snapshot: DashboardSnapshot) {
  return {
    user: compactDashboardUser(snapshot),
    currentSemester: summarizeDashboardCurrentSemester(snapshot),
    subscriptions: {
      totalCount: snapshot.subscriptions.totalCount,
      currentSemesterCount: snapshot.subscriptions.currentSemesterCount,
      currentSemesterSectionsTotal:
        snapshot.subscriptions.currentSemesterSections.length,
    },
    nextClass: snapshot.nextClass
      ? summarizeDashboardCalendarEvent(snapshot.nextClass)
      : null,
    upcomingDeadlines: {
      total: snapshot.upcomingDeadlines.length,
      items: snapshot.upcomingDeadlines
        .slice(0, 3)
        .map(summarizeDashboardCalendarEvent),
    },
    upcomingEvents: {
      total: snapshot.upcomingEvents.length,
      items: snapshot.upcomingEvents
        .slice(0, 3)
        .map(summarizeDashboardCalendarEvent),
    },
    todos: {
      incompleteCount: snapshot.todos.incompleteCount,
    },
    bus: {
      hasPreference:
        snapshot.bus.preference?.preferredOriginCampusId != null &&
        snapshot.bus.preference?.preferredDestinationCampusId != null,
      nextDeparture: snapshot.bus.nextDeparture
        ? summarizeDashboardBusDeparture(snapshot.bus.nextDeparture)
        : null,
      departuresCount: snapshot.bus.departures.length,
    },
  };
}
