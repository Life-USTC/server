import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import { listSubscribedHomeworks } from "@/features/home/server/subscription-read-model";
import { withHomeworkItemState } from "@/features/homeworks/server/homework-item-state";
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
    "list_my_homeworks",
    {
      description:
        "List homeworks across your subscribed sections, including your personal completion state and comment count. " +
        "Use list_homeworks_by_section for a single section's homeworks without completion state.",
      inputSchema: {
        completed: z.boolean().optional(),
        limit: z.number().int().min(1).max(200).default(100),
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    async ({ completed, limit, locale, mode }, extra) => {
      const resolvedMode = resolveMcpMode(mode);
      const userId = getUserId(extra.authInfo);
      const homeworks = await listSubscribedHomeworks(userId, {
        locale,
        completed,
        limit,
      });
      const homeworkItems = await withHomeworkItemState(homeworks);

      return jsonToolResult(
        { homeworks: homeworkItems },
        { mode: resolvedMode },
      );
    },
  );

  server.registerTool(
    "set_my_homework_completion",
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
