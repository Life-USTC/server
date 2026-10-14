import type { McpServer } from "@modelcontextprotocol/server";
import { registerSectionRecordTools } from "@/lib/mcp/tools/catalog/section-records/record-tools";
import { registerSectionHomeworkTools } from "@/lib/mcp/tools/community/homework/homework-tools";

export function registerSectionDataTools(server: McpServer) {
  registerSectionHomeworkTools(server);
  registerSectionRecordTools(server);
}
