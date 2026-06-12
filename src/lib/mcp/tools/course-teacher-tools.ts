import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {
  mcpLocaleInputSchema,
  mcpModeInputSchema,
} from "@/lib/mcp/tools/_helpers";
import {
  getTeacherByIdTool,
  searchTeachersTool,
} from "./course-teacher-tool-handlers";

export function registerCourseTeacherTools(server: McpServer) {
  server.registerTool(
    "search_teachers",
    {
      description:
        "Search teachers by department or name/code. Use the returned id/code to filter search_sections or query_schedules.",
      inputSchema: {
        departmentId: z.number().int().positive().optional(),
        search: z.string().trim().optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    searchTeachersTool,
  );

  server.registerTool(
    "get_teacher_by_id",
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
