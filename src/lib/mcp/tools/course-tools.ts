import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCourseSearchTools } from "@/lib/mcp/tools/course-search-tools";
import { registerCourseSectionMatchTools } from "@/lib/mcp/tools/course-section-match-tools";
import { registerCourseSemesterTools } from "@/lib/mcp/tools/course-semester-tools";
import { registerCourseTeacherTools } from "@/lib/mcp/tools/course-teacher-tools";

export function registerCourseTools(server: McpServer) {
  registerCourseSemesterTools(server);
  registerCourseSearchTools(server);
  registerCourseTeacherTools(server);
  registerCourseSectionMatchTools(server);
}
