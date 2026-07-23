import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {
  mcpLocaleInputSchema,
  mcpModeInputSchema,
} from "@/lib/mcp/tools/_helpers";
import {
  getMyCalendarSubscriptionTool,
  listMySubscribedSectionsTool,
  subscribeSectionByJwIdTool,
  unsubscribeSectionByJwIdTool,
} from "@/lib/mcp/tools/calendar-subscription-tool-handlers";

export function registerCalendarSubscriptionTools(server: McpServer) {
  server.registerTool(
    "workspace_calendar_feed_get",
    {
      description:
        "Get subscribed sections and the personal iCal calendar feed URL. Subscribing is not official USTC enrollment.",
      inputSchema: {
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    getMyCalendarSubscriptionTool,
  );

  server.registerTool(
    "workspace_subscription_list",
    {
      description:
        "List subscribed sections across all semesters, including past terms, for dashboard and calendar personalization. Not official enrollment.",
      inputSchema: {
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    listMySubscribedSectionsTool,
  );

  server.registerTool(
    "workspace_subscription_add",
    {
      description:
        "Subscribe to one section by JW ID for dashboard/calendar. Not official USTC enrollment. " +
        "Use catalog_section_match_preview or catalog_section_search first to find the jwId.",
      inputSchema: {
        jwId: z.number().int().positive(),
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    subscribeSectionByJwIdTool,
  );

  server.registerTool(
    "workspace_subscription_remove",
    {
      description: "Unsubscribe from one section by JW ID.",
      inputSchema: {
        jwId: z.number().int().positive(),
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    unsubscribeSectionByJwIdTool,
  );
}
