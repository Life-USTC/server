import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {
  mcpLocaleInputSchema,
  mcpModeInputSchema,
} from "@/lib/mcp/tools/_helpers";
import {
  getCourseByJwIdTool,
  getSectionByJwIdTool,
  searchCoursesTool,
  searchSectionsTool,
} from "@/lib/mcp/tools/course-search-tool-handlers";

export function registerCourseSearchTools(server: McpServer) {
  server.registerTool(
    "search_courses",
    {
      description:
        "Search courses by Chinese/English name or course code. Use this before search_sections when starting from a course name.",
      inputSchema: {
        search: z.string().trim().min(1),
        limit: z.number().int().min(1).max(25).default(10),
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    searchCoursesTool,
  );

  server.registerTool(
    "get_course_by_jw_id",
    {
      description: "Fetch one detailed course by USTC JW course ID.",
      inputSchema: {
        jwId: z.number().int().positive(),
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    getCourseByJwIdTool,
  );

  server.registerTool(
    "get_section_by_jw_id",
    {
      description:
        "Fetch one detailed section by USTC JW section ID, including course, teachers, semester, schedules, exams, and homeworks.",
      inputSchema: {
        jwId: z.number().int().positive(),
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    getSectionByJwIdTool,
  );

  server.registerTool(
    "search_sections",
    {
      description:
        "Search public sections by course, semester, campus, department, teacher, IDs, or text. " +
        "Use this to find a section jwId before subscription or section-scoped schedule/homework/exam calls.",
      inputSchema: {
        courseId: z.number().int().positive().optional(),
        courseJwId: z.number().int().positive().optional(),
        semesterId: z.number().int().positive().optional(),
        semesterJwId: z.number().int().positive().optional(),
        campusId: z.number().int().positive().optional(),
        departmentId: z.number().int().positive().optional(),
        teacherId: z.number().int().positive().optional(),
        teacherCode: z.string().trim().min(1).optional(),
        ids: z.array(z.number().int().positive()).optional(),
        jwIds: z.array(z.number().int().positive()).optional(),
        search: z.string().trim().optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    searchSectionsTool,
  );
}
