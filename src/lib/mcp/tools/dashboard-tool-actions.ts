import { listUserCalendarEvents } from "@/features/home/server/calendar-events";
import type { AppLocale } from "@/i18n/config";
import {
  getUserId,
  jsonToolResult,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";
import {
  compactDashboardSnapshot,
  summarizeDashboardSnapshot,
} from "@/lib/mcp/tools/dashboard-summary";
import {
  loadDashboardSnapshotForTool,
  parseOptionalDashboardAtTime,
} from "./dashboard-tool-snapshot";

type ToolExtra = { authInfo?: Parameters<typeof getUserId>[0] };
type McpModeInput = Parameters<typeof resolveMcpMode>[0];

export async function getMyDashboardTool(
  {
    locale,
    mode,
    atTime,
  }: { locale: AppLocale; mode?: McpModeInput; atTime?: string },
  extra: ToolExtra,
) {
  const resolvedMode = resolveMcpMode(mode);
  const loaded = await loadDashboardSnapshotForTool({
    atTime,
    extra,
    locale,
  });
  if (!loaded.ok) return loaded.result;
  const { snapshot } = loaded;
  if (resolvedMode === "full") {
    return jsonToolResult(snapshot, { mode: "full" });
  }
  if (resolvedMode === "summary") {
    return jsonToolResult(summarizeDashboardSnapshot(snapshot), {
      mode: "default",
    });
  }
  return jsonToolResult(compactDashboardSnapshot(snapshot), {
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
  const loaded = await loadDashboardSnapshotForTool({
    atTime,
    extra,
    locale,
  });
  if (!loaded.ok) return loaded.result;
  const { snapshot } = loaded;
  return jsonToolResult(
    {
      found: Boolean(snapshot.nextClass),
      nextClass: snapshot.nextClass,
      currentSemester: snapshot.currentSemester,
    },
    { mode: resolveMcpMode(mode) },
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
  const parsedAtTime = parseOptionalDashboardAtTime(atTime);
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
