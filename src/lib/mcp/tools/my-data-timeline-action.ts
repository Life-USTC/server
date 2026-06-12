import { listUserCalendarEvents } from "@/features/home/server/calendar-events";
import {
  getTodayBounds,
  getUserId,
  jsonToolResult,
  parseOptionalMcpDate,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";
import { summarizeCalendarEventCollection } from "@/lib/mcp/tools/event-summary";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";

type McpMode = "summary" | "default" | "full";
type ToolExtra = { authInfo?: Parameters<typeof getUserId>[0] };

export async function getMySevenDaysTimelineAction(
  { locale, atTime, mode }: { locale: string; atTime?: string; mode?: McpMode },
  extra: ToolExtra,
) {
  const resolvedMode = resolveMcpMode(mode);
  const userId = getUserId(extra.authInfo);
  const atTimeDate = parseOptionalMcpDate("atTime", atTime);
  if (!atTimeDate.ok) {
    return atTimeDate.result;
  }
  const { todayStart } = getTodayBounds(atTimeDate.value);
  const windowEnd = new Date(todayStart);
  windowEnd.setDate(windowEnd.getDate() + 7);
  const events = await listUserCalendarEvents(userId, {
    locale,
    dateFrom: todayStart,
    dateTo: windowEnd,
  });

  if (resolvedMode === "summary") {
    return jsonToolResult(
      {
        range: {
          from: toShanghaiIsoString(todayStart),
          to: toShanghaiIsoString(windowEnd),
        },
        total: events.length,
        events: summarizeCalendarEventCollection(events, {
          itemLimit: 5,
          dayLimit: 7,
        }),
      },
      { mode: "default" },
    );
  }

  return jsonToolResult(
    {
      range: {
        from: toShanghaiIsoString(todayStart),
        to: toShanghaiIsoString(windowEnd),
      },
      total: events.length,
      events,
    },
    { mode: resolvedMode },
  );
}
