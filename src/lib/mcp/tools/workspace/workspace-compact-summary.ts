import {
  compactSectionList,
  compactWorkspaceCurrentSemester,
  compactWorkspaceUser,
  summarizeWorkspaceBusDeparture,
  summarizeWorkspaceBusDepartures,
  summarizeWorkspaceCalendarEvent,
  summarizeWorkspaceTodo,
} from "./workspace-summary-common";
import type { WorkspaceSnapshot } from "./workspace-summary-types";

export function compactWorkspaceSnapshot(snapshot: WorkspaceSnapshot) {
  return {
    user: compactWorkspaceUser(snapshot),
    currentSemester: compactWorkspaceCurrentSemester(snapshot),
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
      ? summarizeWorkspaceCalendarEvent(snapshot.nextClass)
      : null,
    upcomingDeadlines: {
      total: snapshot.upcomingDeadlines.length,
      items: snapshot.upcomingDeadlines
        .slice(0, 5)
        .map(summarizeWorkspaceCalendarEvent),
    },
    upcomingEvents: {
      total: snapshot.upcomingEvents.length,
      items: snapshot.upcomingEvents
        .slice(0, 5)
        .map(summarizeWorkspaceCalendarEvent),
    },
    todos: {
      incompleteCount: snapshot.todos.incompleteCount,
      items: snapshot.todos.items.map(summarizeWorkspaceTodo),
    },
    bus: {
      hasPreference:
        snapshot.bus.preference?.preferredOriginCampusId != null &&
        snapshot.bus.preference?.preferredDestinationCampusId != null,
      preference: snapshot.bus.preference,
      nextDeparture: snapshot.bus.nextDeparture
        ? summarizeWorkspaceBusDeparture(snapshot.bus.nextDeparture)
        : null,
      departures: summarizeWorkspaceBusDepartures(snapshot.bus.departures, 3),
    },
  };
}

export function buildFullWorkspaceSnapshot(snapshot: WorkspaceSnapshot) {
  return {
    user: snapshot.user,
    currentSemester: snapshot.currentSemester,
    subscriptions: {
      ...snapshot.subscriptions,
      currentSemesterSectionsTotal:
        snapshot.subscriptions.currentSemesterSections.length,
    },
    nextClass: snapshot.nextClass,
    upcomingDeadlines: {
      total: snapshot.upcomingDeadlines.length,
      items: snapshot.upcomingDeadlines,
    },
    upcomingEvents: {
      total: snapshot.upcomingEvents.length,
      items: snapshot.upcomingEvents,
    },
    todos: snapshot.todos,
    bus: {
      ...snapshot.bus,
      hasPreference:
        snapshot.bus.preference?.preferredOriginCampusId != null &&
        snapshot.bus.preference?.preferredDestinationCampusId != null,
    },
  };
}
