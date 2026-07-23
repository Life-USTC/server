import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import { withHomeworkItemState } from "@/features/homeworks/server/homework-item-state";
import { listSubscribedHomeworks } from "@/features/subscriptions/server/subscription-read-model";
import {
  getUserId,
  jsonToolResult,
  mcpLocaleInputSchema,
  mcpModeInputSchema,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";
import { setMyHomeworkCompletionTool } from "./my-data-homework-completion-tool";

export function registerMyHomeworkTools(server: McpServer) {
  server.registerTool(
    "workspace_homework_list",
    {
      description:
        "List homeworks across your subscribed sections in all semesters, including your personal completion state and comment count. " +
        "Use community_section_homework_list for a single section's homeworks without completion state. " +
        "Pass semesterId to list homeworks from a specific semester (e.g. a previous semester).",
      inputSchema: {
        completed: z.boolean().optional(),
        limit: z.number().int().min(1).max(200).default(100),
        semesterId: z.number().int().min(1).optional(),
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    async ({ completed, limit, semesterId, locale, mode }, extra) => {
      const resolvedMode = resolveMcpMode(mode);
      const userId = getUserId(extra.authInfo);
      const homeworks = await listSubscribedHomeworks(userId, {
        locale,
        completed,
        limit,
        semesterId,
      });
      const homeworkItems = await withHomeworkItemState(homeworks);

      return jsonToolResult(
        { homeworks: homeworkItems },
        { mode: resolvedMode },
      );
    },
  );

  server.registerTool(
    "workspace_homework_completion_set",
    {
      description:
        "Mark a homework as completed or incomplete. Pass completed: false to revert to incomplete.",
      inputSchema: {
        homeworkId: z.string().trim().min(1),
        completed: z.boolean(),
        mode: mcpModeInputSchema,
      },
    },
    setMyHomeworkCompletionTool,
  );
}
