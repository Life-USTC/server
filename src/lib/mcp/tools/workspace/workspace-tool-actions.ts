import { listUserCalendarEvents } from "@/features/calendar/server/calendar-events";
import type { AppLocale } from "@/i18n/config";
import {
  getUserId,
  jsonToolResult,
  resolveMcpMode,
} from "@/lib/mcp/tools/_shared/helpers";
import {
  buildFullWorkspaceSnapshot,
  compactWorkspaceSnapshot,
} from "@/lib/mcp/tools/workspace/workspace-compact-summary";
import {
  summarizeWorkspaceCalendarEvent,
  summarizeWorkspaceCurrentSemester,
} from "@/lib/mcp/tools/workspace/workspace-summary-common";
import {
  loadWorkspaceSnapshotForTool,
  parseOptionalWorkspaceAtTime,
} from "./workspace-tool-snapshot";

type ToolExtra = { authInfo?: Parameters<typeof getUserId>[0] };
type McpModeInput = Parameters<typeof resolveMcpMode>[0];

export async function getWorkspaceTool(
  {
    locale,
    mode,
    atTime,
  }: { locale: AppLocale; mode?: McpModeInput; atTime?: string },
  extra: ToolExtra,
) {
  const resolvedMode = resolveMcpMode(mode);
  const loaded = await loadWorkspaceSnapshotForTool({
    atTime,
    extra,
    locale,
  });
  if (!loaded.ok) return loaded.result;
  const { snapshot } = loaded;
  if (resolvedMode === "full") {
    return jsonToolResult(buildFullWorkspaceSnapshot(snapshot), {
      mode: "full",
    });
  }
  return jsonToolResult(compactWorkspaceSnapshot(snapshot), {
    mode: "default",
  });
}

export async function getNextClassTool(
  {
    locale,
    mode,
    atTime,
  }: { locale: AppLocale; mode?: McpModeInput; atTime?: string },
  extra: ToolExtra,
) {
  const resolvedMode = resolveMcpMode(mode);
  const loaded = await loadWorkspaceSnapshotForTool({
    atTime,
    extra,
    locale,
  });
  if (!loaded.ok) return loaded.result;
  const { snapshot } = loaded;
  if (resolvedMode === "full") {
    return jsonToolResult(
      {
        found: Boolean(snapshot.nextClass),
        nextClass: snapshot.nextClass,
        currentSemester: snapshot.currentSemester,
      },
      { mode: "full" },
    );
  }
  return jsonToolResult(
    {
      found: Boolean(snapshot.nextClass),
      nextClass: snapshot.nextClass
        ? summarizeWorkspaceCalendarEvent(snapshot.nextClass)
        : null,
      currentSemester: summarizeWorkspaceCurrentSemester(snapshot),
    },
    { mode: "default" },
  );
}

export async function getUpcomingDeadlinesTool(
  {
    dayLimit,
    atTime,
    locale,
    mode,
  }: {
    dayLimit: number;
    atTime?: string;
    locale: AppLocale;
    mode?: McpModeInput;
  },
  extra: ToolExtra,
) {
  const userId = getUserId(extra.authInfo);
  const parsedAtTime = parseOptionalWorkspaceAtTime(atTime);
  if (!parsedAtTime.ok) return parsedAtTime.result;
  const now = parsedAtTime.value ?? new Date();
  const dateTo = new Date(now.getTime() + dayLimit * 24 * 60 * 60 * 1000);
  const events = await listUserCalendarEvents(userId, {
    locale,
    dateFrom: now,
    dateTo,
    eventWindowMode: "start",
  });
  const deadlines = (events as Array<{ type: string }>).filter(
    (event) =>
      event.type === "homework_due" ||
      event.type === "exam" ||
      event.type === "todo_due",
  );

  return jsonToolResult(
    {
      total: deadlines.length,
      deadlines,
    },
    { mode: resolveMcpMode(mode) },
  );
}
