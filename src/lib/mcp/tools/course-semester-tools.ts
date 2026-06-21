import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {
  getCurrentSemester,
  listSemesters,
} from "@/features/catalog/server/academic-metadata-read-model";
import {
  jsonToolResult,
  mcpModeInputSchema,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";

export function registerCourseSemesterTools(server: McpServer) {
  server.registerTool(
    "list_semesters",
    {
      description:
        "List semesters with pagination. Use get_current_semester when you only need the active term.",
      inputSchema: {
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
        mode: mcpModeInputSchema,
      },
    },
    async ({ page, limit, mode }) => {
      const result = await listSemesters({ page, pageSize: limit });

      return jsonToolResult(result, {
        mode: resolveMcpMode(mode),
      });
    },
  );

  server.registerTool(
    "get_current_semester",
    {
      description:
        "Get the semester active today. Use its id to constrain section-code matching and section search.",
      inputSchema: {
        mode: mcpModeInputSchema,
      },
    },
    async ({ mode }) => {
      const semester = await getCurrentSemester(new Date());

      return jsonToolResult(
        {
          found: Boolean(semester),
          semester,
        },
        {
          mode: resolveMcpMode(mode),
        },
      );
    },
  );
}
