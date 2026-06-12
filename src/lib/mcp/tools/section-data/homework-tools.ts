import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import { withHomeworkItemState } from "@/features/homeworks/server/homework-item-state";
import {
  jsonToolResult,
  mcpLocaleInputSchema,
  mcpModeInputSchema,
  resolveMcpMode,
  resolveSectionByJwId,
} from "@/lib/mcp/tools/_helpers";
import { summarizeHomeworkCard } from "@/lib/mcp/tools/event-summary";
import { registerCreateHomeworkOnSectionTool } from "./homework-create-tool";
import { buildHomeworkToolInclude } from "./homework-tool-helpers";
import { registerUpdateHomeworkOnSectionTool } from "./homework-update-tool";
import { sectionNotFoundToolResult } from "./shared";

export function registerSectionHomeworkTools(server: McpServer) {
  server.registerTool(
    "list_homeworks_by_section",
    {
      description:
        "Homeworks for one section by JW ID. Includes viewer completion state when authenticated. " +
        "Use list_my_homeworks for all followed sections.",
      inputSchema: {
        sectionJwId: z.number().int().positive(),
        includeDeleted: z.boolean().default(false),
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    async ({ sectionJwId, includeDeleted, locale, mode }, extra) => {
      const resolvedMode = resolveMcpMode(mode);
      const { localizedPrisma, section } = await resolveSectionByJwId(
        sectionJwId,
        locale,
      );

      if (!section) {
        return sectionNotFoundToolResult(sectionJwId, mode);
      }

      const viewerUserId =
        typeof extra.authInfo?.extra?.userId === "string"
          ? extra.authInfo.extra.userId
          : null;
      const homeworks = await localizedPrisma.homework.findMany({
        where: {
          sectionId: section.id,
          ...(includeDeleted ? {} : { deletedAt: null }),
        },
        include: buildHomeworkToolInclude(viewerUserId),
        orderBy: [{ submissionDueAt: "asc" }, { createdAt: "desc" }],
      });
      const homeworkItems = await withHomeworkItemState(homeworks);
      const scopedHomeworkItems = homeworkItems.map(
        ({
          section: _section,
          createdBy: _createdBy,
          updatedBy: _updatedBy,
          deletedBy: _deletedBy,
          ...homework
        }) => homework,
      );

      if (resolvedMode === "summary") {
        return jsonToolResult(
          {
            found: true,
            section,
            homeworks: {
              total: homeworkItems.length,
              items: scopedHomeworkItems.slice(0, 5).map(summarizeHomeworkCard),
            },
          },
          { mode: "default" },
        );
      }

      return jsonToolResult(
        {
          found: true,
          section,
          homeworks:
            resolvedMode === "full" ? homeworkItems : scopedHomeworkItems,
        },
        {
          mode: resolvedMode,
        },
      );
    },
  );

  registerCreateHomeworkOnSectionTool(server);
  registerUpdateHomeworkOnSectionTool(server);
}
