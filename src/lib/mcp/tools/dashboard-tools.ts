import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {
  flexDateInputSchema,
  mcpLocaleInputSchema,
  mcpModeInputSchema,
} from "@/lib/mcp/tools/_helpers";
import {
  getMyDashboardTool,
  getNextClassTool,
  getUpcomingDeadlinesTool,
} from "./dashboard-tool-actions";

export function registerDashboardTools(server: McpServer) {
  server.registerTool(
    "get_my_dashboard",
    {
      description:
        "Single-call snapshot: current courses, next class, upcoming deadlines, todo count, and preferred shuttle. " +
        "Start here for most assistant workflows before fanning out to specific tools.",
      inputSchema: {
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
        atTime: flexDateInputSchema
          .optional()
          .describe(
            "Override the reference time for next class, deadlines, events, current semester, and preferred shuttle. Defaults to now.",
          ),
      },
    },
    getMyDashboardTool,
  );

  server.registerTool(
    "get_next_class",
    {
      description:
        "Next upcoming class from followed sections. Lightweight alternative when only the next class is needed.",
      inputSchema: {
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
        atTime: flexDateInputSchema
          .optional()
          .describe(
            "Override the reference time for the next-class lookup. Defaults to now.",
          ),
      },
    },
    getNextClassTool,
  );

  server.registerTool(
    "get_upcoming_deadlines",
    {
      description:
        "Merged list of upcoming homework deadlines, exams, and due todos within dayLimit days (default 7). " +
        "Pass atTime to anchor the window instead of using the server clock.",
      inputSchema: {
        dayLimit: z.number().int().min(1).max(30).default(7),
        atTime: flexDateInputSchema
          .optional()
          .describe(
            "Override the reference time for the deadline window. Defaults to now. Accepts YYYY-MM-DD or ISO 8601 with offset.",
          ),
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    getUpcomingDeadlinesTool,
  );
}
