import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
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
        title: z.string().trim().min(1).max(200),
        description: z.string().max(20000).optional().nullable(),
        isMajor: z.boolean().optional(),
        requiresTeam: z.boolean().optional(),
        publishedAt: z.union([z.string(), z.null()]).optional(),
        submissionStartAt: z.union([z.string(), z.null()]).optional(),
        submissionDueAt: z.union([z.string(), z.null()]).optional(),
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    createHomeworkOnSectionTool,
  );
}
