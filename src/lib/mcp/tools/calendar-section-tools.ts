import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {
  mcpLocaleInputSchema,
  mcpModeInputSchema,
  sectionCodeSchema,
} from "@/lib/mcp/tools/_helpers";
import {
  getSectionCalendarSubscriptionTool,
  subscribeMySectionsByCodesTool,
} from "./calendar-section-tool-handlers";

export function registerCalendarSectionTools(server: McpServer) {
  server.registerTool(
    "catalog_section_calendar_feed_get",
    {
      description: "Get the iCal feed URL for a single section by JW ID.",
      inputSchema: {
        jwId: z.number().int().positive(),
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    getSectionCalendarSubscriptionTool,
  );

  server.registerTool(
    "workspace_subscription_import",
    {
      description:
        "Match section codes and subscribe in one step. Not official enrollment. " +
        "Use catalog_section_match_preview first for a dry-run preview when confirmation is needed.",
      inputSchema: {
        codes: z.array(sectionCodeSchema).min(1).max(500),
        semesterId: z.number().int().positive().optional(),
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    subscribeMySectionsByCodesTool,
  );
}
