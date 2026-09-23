import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCourseSearchTools } from "@/lib/mcp/tools/catalog/course-search-tools";
import { registerCourseSectionMatchTools } from "@/lib/mcp/tools/catalog/course-section-match-tools";
import { registerCourseSemesterTools } from "@/lib/mcp/tools/catalog/course-semester-tools";
import { registerCourseTeacherTools } from "@/lib/mcp/tools/catalog/course-teacher-tools";

export function registerCourseTools(server: McpServer) {
  registerCourseSemesterTools(server);
  registerCourseSearchTools(server);
  registerCourseTeacherTools(server);
  registerCourseSectionMatchTools(server);
}
