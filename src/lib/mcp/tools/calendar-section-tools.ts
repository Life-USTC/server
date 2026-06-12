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
    "get_section_calendar_subscription",
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
    "subscribe_my_sections_by_codes",
    {
      description:
        "Match section codes and subscribe in one step. Not official enrollment. " +
        "Use match_section_codes first for a dry-run preview when confirmation is needed.",
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
