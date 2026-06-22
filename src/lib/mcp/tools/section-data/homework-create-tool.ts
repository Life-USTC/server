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
import { createHomeworkOnSectionTool } from "./homework-create-tool-handler";

export function registerCreateHomeworkOnSectionTool(server: McpServer) {
  server.registerTool(
    "create_homework_on_section",
    {
      description:
        "Create a homework under one section by section JW ID. Requires unsuspended signed-in user; does not mutate JW/import facts.",
      inputSchema: {
        sectionJwId: z.number().int().positive(),
        title: homeworkTitleSchema,
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
    createHomeworkOnSectionTool,
  );
}
