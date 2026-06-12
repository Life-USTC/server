import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import { findSectionCodeMatches } from "@/lib/course-section-queries";
import {
  jsonToolResult,
  mcpLocaleInputSchema,
  mcpModeInputSchema,
  resolveMcpMode,
  sectionCodeSchema,
} from "@/lib/mcp/tools/_helpers";

const SECTION_SUBSCRIPTION_NOTE =
  "Life@USTC section subscriptions only affect your dashboard and calendar here. They are not official USTC course enrollment.";

export function registerCourseSectionMatchTools(server: McpServer) {
  server.registerTool(
    "match_section_codes",
    {
      description:
        "Dry-run section-code matching for one semester. Returns matched/unmatched codes and suggestions. " +
        "Use before subscribe_my_sections_by_codes when the user may need confirmation. Not official enrollment.",
      inputSchema: {
        codes: z.array(sectionCodeSchema).min(1).max(500),
        semesterId: z.number().int().positive().optional(),
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    async ({ codes, semesterId, locale, mode }) => {
      const matches = await findSectionCodeMatches(codes, locale, semesterId);
      if (!matches) {
        return jsonToolResult({
          success: false,
          message: "No semester found",
        });
      }

      return jsonToolResult(
        {
          success: true,
          semester: matches.semester,
          matchedCodes: matches.matchedCodes,
          unmatchedCodes: matches.unmatchedCodes,
          suggestions: matches.suggestions,
          sections: matches.sections,
          total: matches.total,
          note: SECTION_SUBSCRIPTION_NOTE,
        },
        {
          mode: resolveMcpMode(mode),
        },
      );
    },
  );
}
