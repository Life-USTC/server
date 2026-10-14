import type { McpServer } from "@modelcontextprotocol/server";
import { registerWorkspaceHomeworkTools } from "@/lib/mcp/tools/workspace/workspace-homework-tools";
import { registerWorkspaceOverviewTools } from "@/lib/mcp/tools/workspace/workspace-overview-tools";
import { registerWorkspaceScheduleTools } from "@/lib/mcp/tools/workspace/workspace-schedule-tools";

export function registerWorkspaceDataTools(server: McpServer) {
  registerWorkspaceHomeworkTools(server);
  registerWorkspaceScheduleTools(server);
  registerWorkspaceOverviewTools(server);
}
