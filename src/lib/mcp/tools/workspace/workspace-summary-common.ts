import { compactMcpPayload } from "@/lib/mcp/compact-dispatch";
import { summarizeSectionCard } from "@/lib/mcp/tools/workspace/event-summary-academic-cards";
import { summarizeBusDeparture } from "@/lib/mcp/tools/workspace/event-summary-bus-cards";
import {
  type SummarizableCalendarEvent,
  summarizeBusDepartureList,
  summarizeCalendarEvent,
} from "@/lib/mcp/tools/workspace/event-summary-collections";
import { summarizeTodoCard } from "@/lib/mcp/tools/workspace/event-summary-task-cards";
import type {
  WorkspaceSection,
  WorkspaceSnapshot,
  WorkspaceTodo,
} from "./workspace-summary-types";

export function compactSectionList(
  sections: readonly WorkspaceSection[],
  limit: number,
) {
  return sections
    .slice(0, limit)
    .map((section: WorkspaceSection) => summarizeSectionCard(section));
}

export function compactWorkspaceUser(snapshot: WorkspaceSnapshot) {
  return compactMcpPayload(snapshot.user);
}

export function compactWorkspaceCurrentSemester(snapshot: WorkspaceSnapshot) {
  return compactMcpPayload(snapshot.currentSemester);
}

export function summarizeWorkspaceCurrentSemester(snapshot: WorkspaceSnapshot) {
  return snapshot.currentSemester
    ? {
        code: snapshot.currentSemester.code,
        nameCn: snapshot.currentSemester.nameCn,
      }
    : null;
}

export function summarizeWorkspaceCalendarEvent(event: unknown) {
  return summarizeCalendarEvent(event as SummarizableCalendarEvent);
}

export function summarizeWorkspaceTodo(todo: WorkspaceTodo) {
  return summarizeTodoCard(todo);
}

export function summarizeWorkspaceBusDeparture(departure: unknown) {
  return summarizeBusDeparture(departure);
}

export function summarizeWorkspaceBusDepartures(
  departures: WorkspaceSnapshot["bus"]["departures"],
  limit: number,
) {
  return summarizeBusDepartureList(departures, limit);
}
