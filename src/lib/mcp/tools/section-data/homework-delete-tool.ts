import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import { deleteHomework } from "@/features/homeworks/server/homework-mutations";
import {
  getUserId,
  jsonToolResult,
  mcpModeInputSchema,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";

export function registerDeleteHomeworkOnSectionTool(server: McpServer) {
  server.registerTool(
    "delete_homework_on_section",
    {
      description:
        "Delete a homework by ID. Requires an unsuspended signed-in creator or admin; normal users can delete only homework they created.",
      inputSchema: {
        homeworkId: z.string().trim().min(1),
        mode: mcpModeInputSchema,
      },
    },
    async ({ homeworkId, mode }, extra) => {
      const resolvedMode = resolveMcpMode(mode);
      const userId = getUserId(extra.authInfo);
      const result = await deleteHomework({ homeworkId, userId });

      if (!result.ok) {
        if (result.error === "not_found") {
          return jsonToolResult(
            {
              success: false,
              error: "not_found",
              message: "Homework not found",
              hint: "Use list_homeworks_by_section or list_my_homeworks to confirm the homeworkId before deleting it.",
            },
            { mode: resolvedMode },
          );
        }
        if (result.error === "suspended") {
          return jsonToolResult(
            {
              success: false,
              error: "suspended",
              message: "Suspended",
              reason: "reason" in result ? (result.reason ?? null) : null,
            },
            { mode: resolvedMode },
          );
        }
        return jsonToolResult(
          {
            success: false,
            error: "forbidden",
            message: "Forbidden",
          },
          { mode: resolvedMode },
        );
      }

      return jsonToolResult(
        {
          success: true,
          deletedId: homeworkId,
          alreadyDeleted: result.alreadyDeleted,
        },
        { mode: resolvedMode },
      );
    },
  );
}
