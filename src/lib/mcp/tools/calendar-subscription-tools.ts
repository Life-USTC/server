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
    "get_my_calendar_subscription",
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
    "list_my_subscribed_sections",
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
    "subscribe_section_by_jw_id",
    {
      description:
        "Subscribe to one section by JW ID for dashboard/calendar. Not official USTC enrollment. " +
        "Use match_section_codes or search_sections first to find the jwId.",
      inputSchema: {
        jwId: z.number().int().positive(),
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    subscribeSectionByJwIdTool,
  );

  server.registerTool(
    "unsubscribe_section_by_jw_id",
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
