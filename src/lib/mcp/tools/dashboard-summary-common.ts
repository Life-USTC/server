import { compactMcpPayload } from "@/lib/mcp/compact-dispatch";
import { summarizeSectionCard } from "@/lib/mcp/tools/event-summary-academic-cards";
import { summarizeBusDeparture } from "@/lib/mcp/tools/event-summary-bus-cards";
import {
  type SummarizableCalendarEvent,
  summarizeBusDepartureList,
  summarizeCalendarEvent,
} from "@/lib/mcp/tools/event-summary-collections";
import { summarizeTodoCard } from "@/lib/mcp/tools/event-summary-task-cards";
import type {
  DashboardSection,
  DashboardSnapshot,
  DashboardTodo,
} from "./dashboard-summary-types";

export function compactSectionList(
  sections: readonly DashboardSection[],
  limit: number,
) {
  return sections
    .slice(0, limit)
    .map((section: DashboardSection) => summarizeSectionCard(section));
}

export function compactDashboardUser(snapshot: DashboardSnapshot) {
  return compactMcpPayload(snapshot.user);
}

export function compactDashboardCurrentSemester(snapshot: DashboardSnapshot) {
  return compactMcpPayload(snapshot.currentSemester);
}

export function summarizeDashboardCurrentSemester(snapshot: DashboardSnapshot) {
  return snapshot.currentSemester
    ? {
        code: snapshot.currentSemester.code,
        nameCn: snapshot.currentSemester.nameCn,
      }
    : null;
}

export function summarizeDashboardCalendarEvent(event: unknown) {
  return summarizeCalendarEvent(event as SummarizableCalendarEvent);
}

export function summarizeDashboardTodo(todo: DashboardTodo) {
  return summarizeTodoCard(todo);
}

export function summarizeDashboardBusDeparture(departure: unknown) {
  return summarizeBusDeparture(departure);
}

export function summarizeDashboardBusDepartures(
  departures: DashboardSnapshot["bus"]["departures"],
  limit: number,
) {
  return summarizeBusDepartureList(departures, limit);
}
