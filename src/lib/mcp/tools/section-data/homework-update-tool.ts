import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {
  homeworkDateInputSchema,
  homeworkDescriptionInputSchema,
  homeworkTitleSchema,
} from "@/features/homeworks/lib/homework-schema";
import {
  mcpLocaleInputSchema,
  mcpModeInputSchema,
} from "@/lib/mcp/tools/_helpers";
import { updateHomeworkOnSectionTool } from "./homework-update-tool-handler";

export function registerUpdateHomeworkOnSectionTool(server: McpServer) {
  server.registerTool(
    "update_homework_on_section",
    {
      description:
        "Update a homework by ID and optionally replace/upsert its description. Requires collaborator permissions and unsuspended user.",
      inputSchema: {
        homeworkId: z.string().trim().min(1),
        title: homeworkTitleSchema.optional(),
        description: homeworkDescriptionInputSchema,
        isMajor: z.boolean().optional(),
        requiresTeam: z.boolean().optional(),
        publishedAt: homeworkDateInputSchema,
        submissionStartAt: homeworkDateInputSchema,
        submissionDueAt: homeworkDateInputSchema,
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    updateHomeworkOnSectionTool,
  );
}
