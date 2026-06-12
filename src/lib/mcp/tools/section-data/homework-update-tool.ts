import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import { mcpModeInputSchema } from "@/lib/mcp/tools/_helpers";
import { updateHomeworkOnSectionTool } from "./homework-update-tool-handler";

export function registerUpdateHomeworkOnSectionTool(server: McpServer) {
  server.registerTool(
    "update_homework_on_section",
    {
      description:
        "Update a homework by ID and optionally replace/upsert its description. Requires collaborator permissions and unsuspended user.",
      inputSchema: {
        homeworkId: z.string().trim().min(1),
        title: z.string().trim().min(1).max(200).optional(),
        description: z.string().max(20000).optional().nullable(),
        isMajor: z.boolean().optional(),
        requiresTeam: z.boolean().optional(),
        publishedAt: z.union([z.string(), z.null()]).optional(),
        submissionStartAt: z.union([z.string(), z.null()]).optional(),
        submissionDueAt: z.union([z.string(), z.null()]).optional(),
        mode: mcpModeInputSchema,
      },
    },
    updateHomeworkOnSectionTool,
  );
}
