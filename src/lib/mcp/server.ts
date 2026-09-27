import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  GRAPHQL_OPERATION_PROMPT_NAME,
  registerGraphqlPrompts,
} from "@/lib/graphql/prompts";
import { registerGraphqlResources } from "@/lib/graphql/resources";
import { registerBusTools } from "@/lib/mcp/tools/bus/bus-tools";
import { registerCourseTools } from "@/lib/mcp/tools/catalog/course-tools";
import { registerRoomMapTools } from "@/lib/mcp/tools/catalog/room-map-tools";
import { registerSectionDataTools } from "@/lib/mcp/tools/catalog/section-data-tools";
import { registerWeatherTools } from "@/lib/mcp/tools/catalog/weather-tools";
import { registerYoungEventTools } from "@/lib/mcp/tools/catalog/young-event-tools";
import { registerCommentTools } from "@/lib/mcp/tools/community/comment-tools";
import { registerDescriptionTools } from "@/lib/mcp/tools/community/description-tools";
import { registerGraphqlOperationTool } from "@/lib/mcp/tools/graphql/graphql-operation-tool";
import { registerUploadTools } from "@/lib/mcp/tools/uploads/upload-tools";
import { registerCalendarTools } from "@/lib/mcp/tools/workspace/calendar-tools";
import { registerProfileTools } from "@/lib/mcp/tools/workspace/profile-tools";
import { registerWorkspaceDataTools } from "@/lib/mcp/tools/workspace/workspace-data-tools";
import { registerWorkspaceTools } from "@/lib/mcp/tools/workspace/workspace-tools";
import {
  assertRegisteredMcpToolMetadata,
  installMcpToolDescriptorDefaults,
  installMcpToolListCompatibility,
} from "./tool-descriptors";
import { registerYoungWorkspaceTools } from "./tools/workspace/young-workspace-tools";

const SERVER_INSTRUCTIONS = [
  "Use workspace_snapshot_get or workspace_overview_get before fanning out into narrower personal tools.",
  "A zero currentSemesterCount means no current-semester subscriptions, not necessarily no course history; when totalCount is larger, use workspace_subscription_list and the semesterId filters on workspace_homework_list, workspace_schedule_list, or workspace_exam_list to recover past-term data.",
  "Use catalog_course_search, catalog_section_search, catalog_teacher_search, catalog_bus_route_list, or catalog_link_list to discover stable IDs before ID-based calls.",
  `Use ${GRAPHQL_OPERATION_PROMPT_NAME} when composing an unfamiliar GraphQL call. It injects life-ustc://graphql/schema and life-ustc://graphql/operations; graphql_operation_run accepts arbitrary documents or compatible registered operations. Field scopes and mutation confirmation are always enforced.`,
  "Mutation tools change Life@USTC user or collaborative data; summarize the intended change and ask for user confirmation before calling them.",
  "Workflow reference: workspace_snapshot_get provides broad personal context and requires workspace.overview:read. workspace_schedule_next answers the focused next-class question and requires both workspace.overview:read and workspace.schedule:read.",
  "catalog_bus_departure_next answers the focused next-bus question; it is public and requires no OAuth scopes. Supply originCampusId and destinationCampusId; omitted dayType=auto, includeDeparted=false and limit=5 use the current Shanghai day and exclude departed trips.",
  "catalog_section_match_preview is public and requires no OAuth scopes. It lists all matching sections and the subscription effect without changing user data; omitted semesterId selects the current semester. Review the preview before calling workspace_subscription_import with the same codes and semesterId; import requires workspace.subscription:write and changes only Life@USTC subscriptions, not official course enrollment.",
  "For these workflows, omitted mode=default and locale=zh-cn. Omitted atTime uses the server clock for snapshot, next class and next bus. Full mode adds only allowed fields and never relaxes privacy: private calendar-feed URLs, calendar path credentials and tokens are never exposed by MCP; do not request, echo or invent those secrets.",
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
  registerWorkspaceTools(server);
  registerSectionDataTools(server);
  registerWeatherTools(server);
  registerRoomMapTools(server);
  registerYoungEventTools(server);
  registerYoungWorkspaceTools(server);
  registerWorkspaceDataTools(server);
  registerCalendarTools(server);
  registerGraphqlOperationTool(server);
  registerGraphqlResources(server);
  registerGraphqlPrompts(server);
  assertRegisteredMcpToolMetadata(server);
  installMcpToolListCompatibility(server);

  return server;
}
