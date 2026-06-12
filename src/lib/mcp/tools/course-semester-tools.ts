import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import { buildPaginatedResponse, normalizePagination } from "@/lib/api/helpers";
import { findCurrentSemester } from "@/lib/current-semester";
import { prisma } from "@/lib/db/prisma";
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
      const pagination = normalizePagination({ page, pageSize: limit });
      const [semesters, total] = await Promise.all([
        prisma.semester.findMany({
          skip: pagination.skip,
          take: pagination.pageSize,
          orderBy: { startDate: "desc" },
        }),
        prisma.semester.count(),
      ]);

      return jsonToolResult(
        buildPaginatedResponse(
          semesters,
          pagination.page,
          pagination.pageSize,
          total,
        ),
        {
          mode: resolveMcpMode(mode),
        },
      );
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
      const semester = await findCurrentSemester(prisma.semester, new Date());

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
