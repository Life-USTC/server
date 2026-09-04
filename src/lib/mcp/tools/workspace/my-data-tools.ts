import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerMyHomeworkTools } from "@/lib/mcp/tools/workspace/my-data-homework-tools";
import { registerMyScheduleTools } from "@/lib/mcp/tools/workspace/my-data-schedule-tools";
import { registerMyOverviewTools } from "@/lib/mcp/tools/workspace/workspace-overview-tools";

export function registerMyDataTools(server: McpServer) {
  registerMyHomeworkTools(server);
  registerMyScheduleTools(server);
  registerMyOverviewTools(server);
}
