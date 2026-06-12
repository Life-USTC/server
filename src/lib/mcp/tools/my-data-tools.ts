import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerMyHomeworkTools } from "@/lib/mcp/tools/my-data-homework-tools";
import { registerMyOverviewTools } from "@/lib/mcp/tools/my-data-overview-tools";
import { registerMyScheduleTools } from "@/lib/mcp/tools/my-data-schedule-tools";

export function registerMyDataTools(server: McpServer) {
  registerMyHomeworkTools(server);
  registerMyScheduleTools(server);
  registerMyOverviewTools(server);
}
