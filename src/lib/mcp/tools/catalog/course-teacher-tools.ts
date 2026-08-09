import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {
  CATALOG_MAX_PAGE,
  CATALOG_SEARCH_MAX_LENGTH,
  CATALOG_SEARCH_MIN_LENGTH,
} from "@/features/catalog/lib/catalog-list-query";
import {
  mcpLocaleInputSchema,
  mcpModeInputSchema,
} from "@/lib/mcp/tools/_shared/helpers";
import {
  getTeacherByIdTool,
  searchTeachersTool,
} from "./course-teacher-tool-handlers";

export function registerCourseTeacherTools(server: McpServer) {
  server.registerTool(
    "catalog_teacher_search",
    {
      description:
        "Search teachers by department or name/code. Use the returned id/code to filter catalog_section_search or catalog_schedule_list.",
      inputSchema: {
        departmentId: z.number().int().positive().optional(),
        search: z
          .string()
          .trim()
          .min(CATALOG_SEARCH_MIN_LENGTH)
          .max(CATALOG_SEARCH_MAX_LENGTH)
          .optional(),
        page: z.number().int().min(1).max(CATALOG_MAX_PAGE).default(1),
        limit: z.number().int().min(1).max(100).default(20),
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    searchTeachersTool,
  );

  server.registerTool(
    "catalog_teacher_get",
    {
      description:
        "Fetch one detailed teacher by numeric ID, including department and related sections.",
      inputSchema: {
        id: z.number().int().positive(),
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    getTeacherByIdTool,
  );
}
