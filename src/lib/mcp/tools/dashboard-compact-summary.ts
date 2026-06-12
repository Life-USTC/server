import {
  compactDashboardCurrentSemester,
  compactDashboardUser,
  compactSectionList,
  summarizeDashboardBusDeparture,
  summarizeDashboardBusDepartures,
  summarizeDashboardCalendarEvent,
  summarizeDashboardTodo,
} from "./dashboard-summary-common";
import type { DashboardSnapshot } from "./dashboard-summary-types";

export function compactDashboardSnapshot(snapshot: DashboardSnapshot) {
  return {
    user: compactDashboardUser(snapshot),
    currentSemester: compactDashboardCurrentSemester(snapshot),
    subscriptions: {
      totalCount: snapshot.subscriptions.totalCount,
      currentSemesterCount: snapshot.subscriptions.currentSemesterCount,
      currentSemesterSections: compactSectionList(
        snapshot.subscriptions.currentSemesterSections,
        5,
      ),
      currentSemesterSectionsTotal:
        snapshot.subscriptions.currentSemesterSections.length,
    },
    nextClass: snapshot.nextClass
      ? summarizeDashboardCalendarEvent(snapshot.nextClass)
      : null,
    upcomingDeadlines: {
      total: snapshot.upcomingDeadlines.length,
      items: snapshot.upcomingDeadlines
        .slice(0, 5)
        .map(summarizeDashboardCalendarEvent),
    },
    upcomingEvents: {
      total: snapshot.upcomingEvents.length,
      items: snapshot.upcomingEvents
        .slice(0, 5)
        .map(summarizeDashboardCalendarEvent),
    },
    todos: {
      incompleteCount: snapshot.todos.incompleteCount,
      items: snapshot.todos.items.map(summarizeDashboardTodo),
    },
    bus: {
      hasPreference:
        snapshot.bus.preference?.preferredOriginCampusId != null &&
        snapshot.bus.preference?.preferredDestinationCampusId != null,
      preference: snapshot.bus.preference,
      nextDeparture: snapshot.bus.nextDeparture
        ? summarizeDashboardBusDeparture(snapshot.bus.nextDeparture)
        : null,
      departures: summarizeDashboardBusDepartures(snapshot.bus.departures, 3),
    },
  };
}
