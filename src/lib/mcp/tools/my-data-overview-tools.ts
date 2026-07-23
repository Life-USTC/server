import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  flexDateInputSchema,
  mcpLocaleInputSchema,
  mcpModeInputSchema,
} from "@/lib/mcp/tools/_helpers";
import { getMyOverviewAction } from "@/lib/mcp/tools/my-data-overview-action";
import { getMySevenDaysTimelineAction } from "@/lib/mcp/tools/my-data-timeline-action";

export function registerMyOverviewTools(server: McpServer) {
  server.registerTool(
    "workspace_overview_get",
    {
      description:
        "Counts and top samples of pending todos, homeworks, today's schedules, and upcoming exams. " +
        "Lighter than workspace_snapshot_get. Pass atTime to anchor to a specific day.",
      inputSchema: {
        locale: mcpLocaleInputSchema,
        atTime: flexDateInputSchema
          .optional()
          .describe(
            "Override the current time for this query. Useful for testing or asking about a specific day.",
          ),
        homeworkWindowDays: z
          .number()
          .int()
          .min(1)
          .max(90)
          .optional()
          .describe("Homework and due-todo lookahead window in days."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Maximum sample count for each overview group."),
        mode: mcpModeInputSchema,
      },
    },
    getMyOverviewAction,
  );

  server.registerTool(
    "workspace_calendar_timeline_get",
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
