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
        "Get followed sections and the personal iCal calendar feed URL. Following is not official USTC enrollment.",
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
        "List sections currently followed for dashboard and calendar personalization. Not official enrollment.",
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
        "Follow one section by JW ID for dashboard/calendar. Not official USTC enrollment. " +
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
      description: "Unfollow one section by JW ID.",
      inputSchema: {
        jwId: z.number().int().positive(),
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    unsubscribeSectionByJwIdTool,
  );
}
