import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {
  flexDateInputSchema,
  mcpLocaleInputSchema,
  mcpModeInputSchema,
} from "@/lib/mcp/tools/_shared/helpers";
import {
  listCatalogLinksTool,
  listWorkspaceLinkPinsTool,
  setWorkspaceLinkPinStateTool,
} from "./workspace-link-tool-actions";
import {
  getNextClassTool,
  getUpcomingDeadlinesTool,
  getWorkspaceTool,
} from "./workspace-tool-actions";

export function registerWorkspaceTools(server: McpServer) {
  server.registerTool(
    "workspace_snapshot_get",
    {
      description:
        "Single-call snapshot: current courses, next class, upcoming deadlines, todo count, and preferred shuttle. " +
        "Start here for most assistant workflows before fanning out to specific tools. " +
        "If subscriptions.totalCount exceeds currentSemesterCount, past-term subscriptions still exist; use workspace_subscription_list and semester-scoped personal list tools for history.",
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
    getWorkspaceTool,
  );

  server.registerTool(
    "workspace_schedule_next",
    {
      description:
        "Focused extract for 'what is my next class?' from subscribed sections. " +
        "Prefer workspace_snapshot_get when deadlines, todos, or bus context are also needed. " +
        "Default mode compacts schedule payloads; use full mode for raw nested room and teacher fields.",
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
    "workspace_deadline_list",
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
    "catalog_link_list",
    {
      description: "List or search the public USTC campus link catalog.",
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
    listCatalogLinksTool,
  );

  server.registerTool(
    "workspace_link_pin_list",
    {
      description: "List campus link slugs pinned by the authenticated user.",
      inputSchema: { mode: mcpModeInputSchema },
    },
    listWorkspaceLinkPinsTool,
  );

  server.registerTool(
    "workspace_link_pin_set",
    {
      description:
        "Pin or unpin one USTC catalog link for the authenticated user.",
      inputSchema: {
        slug: z
          .string()
          .trim()
          .min(1)
          .describe("Campus link slug from catalog_link_list."),
        action: z.enum(["pin", "unpin"]).describe("Pin or unpin the link."),
        mode: mcpModeInputSchema,
      },
    },
    setWorkspaceLinkPinStateTool,
  );
}
