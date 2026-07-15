import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {
  flexDateInputSchema,
  mcpLocaleInputSchema,
  mcpModeInputSchema,
} from "@/lib/mcp/tools/_helpers";
import {
  listDashboardLinksTool,
  setDashboardLinkPinStateTool,
} from "./dashboard-link-tool-actions";
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
        "Start here for most assistant workflows before fanning out to specific tools. " +
        "If subscriptions.totalCount exceeds currentSemesterCount, past-term follows still exist; use list_my_subscribed_sections and semester-scoped personal list tools for history.",
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

  server.registerTool(
    "list_dashboard_links",
    {
      description:
        "List or search USTC dashboard links with the authenticated user's current pin state.",
      inputSchema: {
        query: z
          .string()
          .trim()
          .max(80)
          .optional()
          .describe(
            "Optional search query matched against title, description, and pinyin fields.",
          ),
        mode: mcpModeInputSchema,
      },
    },
    listDashboardLinksTool,
  );

  server.registerTool(
    "set_dashboard_link_pin_state",
    {
      description:
        "Pin or unpin one USTC dashboard link for the authenticated user.",
      inputSchema: {
        slug: z
          .string()
          .trim()
          .min(1)
          .describe("Dashboard link slug from list_dashboard_links."),
        action: z.enum(["pin", "unpin"]).describe("Pin or unpin the link."),
        mode: mcpModeInputSchema,
      },
    },
    setDashboardLinkPinStateTool,
  );
}
