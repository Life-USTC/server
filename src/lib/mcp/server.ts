import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGraphqlResources } from "@/lib/graphql/resources";
import { registerBusTools } from "@/lib/mcp/tools/bus-tools";
import { registerCalendarTools } from "@/lib/mcp/tools/calendar-tools";
import { registerCommentTools } from "@/lib/mcp/tools/comment-tools";
import { registerCourseTools } from "@/lib/mcp/tools/course-tools";
import { registerDashboardTools } from "@/lib/mcp/tools/dashboard-tools";
import { registerDescriptionTools } from "@/lib/mcp/tools/description-tools";
import { registerMyDataTools } from "@/lib/mcp/tools/my-data-tools";
import { registerProfileTools } from "@/lib/mcp/tools/profile-tools";
import { registerSectionDataTools } from "@/lib/mcp/tools/section-data-tools";
import { registerUploadTools } from "@/lib/mcp/tools/upload-tools";
import {
  assertRegisteredMcpToolMetadata,
  installMcpToolDescriptorDefaults,
  installMcpToolListCompatibility,
} from "./tool-descriptors";

const SERVER_INSTRUCTIONS = [
  "Use get_my_dashboard or get_my_overview before fanning out into narrower personal tools.",
  "A zero currentSemesterCount means no current-semester follows, not necessarily no course history; when totalCount is larger, use list_my_subscribed_sections and the semesterId filters on list_my_homeworks, list_my_schedules, or list_my_exams to recover past-term data.",
  "Use search_courses, search_sections, search_teachers, list_bus_routes, or list_dashboard_links to discover stable IDs before ID-based calls.",
  "Mutation tools change Life@USTC user or collaborative data; summarize the intended change and ask for user confirmation before calling them.",
].join(" ");

export function createMcpServer() {
  const server = new McpServer(
    {
      name: "life-ustc-mcp",
      version: "1.0.0",
    },
    {
      instructions: SERVER_INSTRUCTIONS,
    },
  );

  installMcpToolDescriptorDefaults(server);

  registerBusTools(server);
  registerCommentTools(server);
  registerDescriptionTools(server);
  registerProfileTools(server);
  registerUploadTools(server);
  registerCourseTools(server);
  registerDashboardTools(server);
  registerSectionDataTools(server);
  registerMyDataTools(server);
  registerCalendarTools(server);
  registerGraphqlResources(server);
  assertRegisteredMcpToolMetadata(server);
  installMcpToolListCompatibility(server);

  return server;
}
