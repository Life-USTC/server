import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {
  getYoungEvent,
  listYoungEvents,
} from "@/features/young/server/young-event-service";
import {
  jsonToolResult,
  type McpModeInput,
  mcpModeInputSchema,
  resolveMcpMode,
} from "@/lib/mcp/tools/_shared/helpers";

async function listYoungEventsTool({
  active,
  category,
  search,
  page,
  limit,
  mode,
}: {
  active?: boolean;
  category?: string;
  search?: string;
  page: number;
  limit: number;
  mode?: McpModeInput;
}) {
  const result = await listYoungEvents({
    active,
    category,
    search,
    page,
    pageSize: limit,
  });
  return jsonToolResult(result, { mode: resolveMcpMode(mode) });
}

async function getYoungEventTool({
  youngId,
  mode,
}: {
  youngId: string;
  mode?: McpModeInput;
}) {
  const resolvedMode = resolveMcpMode(mode);
  const event = await getYoungEvent(youngId);

  if (event == null) {
    return jsonToolResult(
      { found: false, youngId, event: null },
      { mode: resolvedMode },
    );
  }

  if (resolvedMode === "full") {
    return jsonToolResult({ found: true, youngId, event }, { mode: "full" });
  }

  const { rawJson: _rawJson, ...summary } = event;
  return jsonToolResult(
    { found: true, youngId, event: summary },
    { mode: "default" },
  );
}

export function registerYoungEventTools(server: McpServer) {
  server.registerTool(
    "catalog_young_event_list",
    {
      description:
        "List second-classroom (第二课堂) signup events from young.ustc.edu.cn: name, category, signup window, event time, capacity, applied count, and status. Sign-up itself happens on young.ustc.edu.cn.",
      inputSchema: {
        active: z
          .boolean()
          .optional()
          .describe("Filter by signup-open (active) events."),
        category: z
          .string()
          .trim()
          .min(1)
          .max(100)
          .optional()
          .describe("Exact category filter, e.g. 单次项目 or 系列项目."),
        search: z
          .string()
          .trim()
          .min(1)
          .max(100)
          .optional()
          .describe("Case-insensitive substring match on the event name."),
        page: z.number().int().min(1).max(1000).default(1),
        limit: z.number().int().min(1).max(100).default(20),
        mode: mcpModeInputSchema,
      },
    },
    listYoungEventsTool,
  );

  server.registerTool(
    "catalog_young_event_get",
    {
      description:
        "Fetch one second-classroom (第二课堂) signup event by its young.ustc.edu.cn identifier. Full mode includes the raw upstream payload.",
      inputSchema: {
        youngId: z.string().trim().min(1),
        mode: mcpModeInputSchema,
      },
    },
    getYoungEventTool,
  );
}
