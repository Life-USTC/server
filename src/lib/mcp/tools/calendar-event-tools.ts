import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listUserCalendarEvents } from "@/features/calendar/server/calendar-events";
import {
  flexDateInputSchema,
  getUserId,
  jsonToolResult,
  mcpLocaleInputSchema,
  mcpModeInputSchema,
  parseMcpDateRange,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";

export function registerCalendarEventTools(server: McpServer) {
  server.registerTool(
    "workspace_calendar_event_list",
    {
      description:
        "Unified personal calendar events (schedules, homework deadlines, exams, todos) filtered by date range. " +
        "Use workspace_calendar_timeline_get for a no-date-required 7-day window.",
      inputSchema: {
        dateFrom: flexDateInputSchema
          .optional()
          .describe(
            "Start of the date range (inclusive). Accepts YYYY-MM-DD or ISO 8601 with offset.",
          ),
        dateTo: flexDateInputSchema
          .optional()
          .describe(
            "End of the date range (inclusive). Accepts YYYY-MM-DD or ISO 8601 with offset.",
          ),
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    async ({ dateFrom, dateTo, locale, mode }, extra) => {
      const dateRange = parseMcpDateRange({ dateFrom, dateTo });
      if (!dateRange.ok) {
        return dateRange.result;
      }
      const events = await listUserCalendarEvents(getUserId(extra.authInfo), {
        locale,
        dateFrom: dateRange.dateFrom,
        dateTo: dateRange.dateTo,
        dateFromIsDateOnly: dateRange.dateFromIsDateOnly,
        dateToIsDateOnly: dateRange.dateToIsDateOnly,
        dateToInclusive: true,
      });
      const resolvedMode = resolveMcpMode(mode);

      return jsonToolResult(
        {
          events,
        },
        { mode: resolvedMode },
      );
    },
  );
}
