import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  flexDateInputSchema,
  mcpLocaleInputSchema,
  mcpModeInputSchema,
} from "@/lib/mcp/tools/_helpers";
import {
  getMyOverviewAction,
  getMySevenDaysTimelineAction,
} from "@/lib/mcp/tools/my-data-overview-actions";

export function registerMyOverviewTools(server: McpServer) {
  server.registerTool(
    "get_my_overview",
    {
      description:
        "Counts and top samples of pending todos, homeworks, today's schedules, and upcoming exams. " +
        "Lighter than get_my_dashboard. Pass atTime to anchor to a specific day.",
      inputSchema: {
        locale: mcpLocaleInputSchema,
        atTime: flexDateInputSchema
          .optional()
          .describe(
            "Override the current time for this query. Useful for testing or asking about a specific day.",
          ),
        mode: mcpModeInputSchema,
      },
    },
    getMyOverviewAction,
  );

  server.registerTool(
    "get_my_7days_timeline",
    {
      description:
        "Next 7 days of unified calendar events (schedules, homework deadlines, exams, todos). " +
        "Pass atTime to anchor the window start; default is today (Asia/Shanghai).",
      inputSchema: {
        locale: mcpLocaleInputSchema,
        atTime: flexDateInputSchema
          .optional()
          .describe(
            "Override the start of the 7-day window. Defaults to today in Asia/Shanghai. Accepts YYYY-MM-DD or ISO 8601 with offset.",
          ),
        mode: mcpModeInputSchema,
      },
    },
    getMySevenDaysTimelineAction,
  );
}
