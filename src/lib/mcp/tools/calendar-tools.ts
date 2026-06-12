import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCalendarEventTools } from "@/lib/mcp/tools/calendar-event-tools";
import { registerCalendarSectionTools } from "@/lib/mcp/tools/calendar-section-tools";
import { registerCalendarSubscriptionTools } from "@/lib/mcp/tools/calendar-subscription-tools";

export function registerCalendarTools(server: McpServer) {
  registerCalendarSubscriptionTools(server);
  registerCalendarSectionTools(server);
  registerCalendarEventTools(server);
}
