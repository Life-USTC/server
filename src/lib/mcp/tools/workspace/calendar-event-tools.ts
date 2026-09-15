import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listUserCalendarEvents } from "@/features/calendar/server/calendar-events";
import { parsePersonalCalendarRange } from "@/features/calendar/server/personal-calendar-range";
import {
  flexDateInputSchema,
  getUserId,
  jsonToolResult,
  mcpLocaleInputSchema,
  mcpModeInputSchema,
  resolveMcpMode,
} from "@/lib/mcp/tools/_shared/helpers";

export function registerCalendarEventTools(server: McpServer) {
  server.registerTool(
    "workspace_calendar_event_list",
    {
      description:
        "Unified personal calendar events (schedules, homework deadlines, exams, todos, subscribed Young events) filtered by date range. " +
        "Supply both date bounds or neither, at most 366 days. Use workspace_calendar_timeline_get for a no-date-required 7-day window.",
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
      let range: ReturnType<typeof parsePersonalCalendarRange>;
      try {
        range = parsePersonalCalendarRange({ dateFrom, dateTo });
      } catch {
        return jsonToolResult({
          success: false,
          error:
            "Supply both dates or neither; range must be valid, ordered and at most 366 days.",
        });
      }
      const events = await listUserCalendarEvents(getUserId(extra.authInfo), {
        locale,
        ...range,
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
