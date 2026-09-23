import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {
  getYoungEvent,
  getYoungOrganizer,
  listYoungEvents,
  listYoungOrganizers,
} from "@/features/young/server/young-event-service";
import {
  flexDateInputSchema,
  jsonToolResult,
  type McpModeInput,
  mcpModeInputSchema,
  parseMcpDateRange,
  resolveMcpMode,
} from "@/lib/mcp/tools/_shared/helpers";

async function listYoungEventsTool({
  active,
  category,
  module,
  activityLevel,
  search,
  organizerId,
  dateFrom,
  dateTo,
  timeBasis,
  dateUnknown,
  page,
  limit,
  mode,
}: {
  active?: boolean;
  dateUnknown?: boolean;
  category?: string;
  module?: string;
  activityLevel?: string;
  search?: string;
  organizerId?: string;
  dateFrom?: string;
  dateTo?: string;
  timeBasis?: "activity" | "registration";
  page: number;
  limit: number;
  mode?: McpModeInput;
}) {
  const dateRange = parseMcpDateRange({ dateFrom, dateTo });
  if (!dateRange.ok) return dateRange.result;

  try {
    const result = await listYoungEvents({
      active,
      category,
      module,
      activityLevel,
      search,
      organizerId,
      dateFrom,
      dateTo,
      timeBasis,
      dateUnknown,
      page,
      pageSize: limit,
    });
    return jsonToolResult(result, { mode: resolveMcpMode(mode) });
  } catch (error) {
    if (error instanceof RangeError) {
      return jsonToolResult({ success: false, message: error.message });
    }
    throw error;
  }
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

async function listYoungOrganizersTool({
  search,
  page,
  limit,
  mode,
}: {
  search?: string;
  page: number;
  limit: number;
  mode?: McpModeInput;
}) {
  const result = await listYoungOrganizers({
    search,
    page,
    pageSize: limit,
  });
  return jsonToolResult(result, { mode: resolveMcpMode(mode) });
}

async function getYoungOrganizerTool({
  organizerId,
  mode,
}: {
  organizerId: string;
  mode?: McpModeInput;
}) {
  const resolvedMode = resolveMcpMode(mode);
  const organizer = await getYoungOrganizer(organizerId);
  return jsonToolResult(
    { found: organizer != null, organizerId, organizer },
    { mode: resolvedMode },
  );
}

export function registerYoungEventTools(server: McpServer) {
  server.registerTool(
    "catalog_young_event_list",
    {
      description:
        "List second-classroom (第二课堂) signup events from young.ustc.edu.cn: name, category, module, activity level, participation form, signup window, event time, capacity, applied count, and status. Filter by module (德/智/体/美/劳) or activity level (院级/校级/…). Sign-up itself happens on young.ustc.edu.cn.",
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
        module: z
          .string()
          .trim()
          .min(1)
          .max(100)
          .optional()
          .describe(
            "Exact second-classroom module filter, e.g. 德/智/体/美/劳.",
          ),
        activityLevel: z
          .string()
          .trim()
          .min(1)
          .max(100)
          .optional()
          .describe("Exact activity-level filter, e.g. 院级 or 校级."),
        search: z
          .string()
          .trim()
          .min(1)
          .max(100)
          .optional()
          .describe("Case-insensitive substring match on the event name."),
        organizerId: z
          .string()
          .trim()
          .min(1)
          .max(100)
          .optional()
          .describe("Stable local Young organizer ID."),
        dateFrom: flexDateInputSchema
          .max(50)
          .optional()
          .describe("Inclusive Shanghai date/time range start."),
        dateTo: flexDateInputSchema
          .max(50)
          .optional()
          .describe("Inclusive Shanghai date/time range end."),
        dateUnknown: z
          .boolean()
          .optional()
          .describe(
            "Filter activities with no known start; incompatible with date bounds.",
          ),
        timeBasis: z
          .enum(["activity", "registration"])
          .optional()
          .describe("Date fields to use for range overlap filtering."),
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
        "Fetch one second-classroom (第二课堂) signup event by its young.ustc.edu.cn identifier, including the sanitized description, participation notes and per-slot venues. Full mode also includes the raw upstream payload.",
      inputSchema: {
        youngId: z.string().trim().min(1),
        mode: mcpModeInputSchema,
      },
    },
    getYoungEventTool,
  );

  server.registerTool(
    "catalog_young_organizer_list",
    {
      description:
        "List normalized second-classroom organizers and their active, upcoming, and historical activities.",
      inputSchema: {
        search: z
          .string()
          .trim()
          .min(1)
          .max(100)
          .optional()
          .describe("Case-insensitive substring match on organizer name."),
        page: z.number().int().min(1).max(1000).default(1),
        limit: z.number().int().min(1).max(100).default(20),
        mode: mcpModeInputSchema,
      },
    },
    listYoungOrganizersTool,
  );

  server.registerTool(
    "catalog_young_organizer_get",
    {
      description:
        "Fetch one normalized second-classroom organizer by its stable local ID, including active, upcoming, and historical activities.",
      inputSchema: {
        organizerId: z.string().trim().min(1).max(100),
        mode: mcpModeInputSchema,
      },
    },
    getYoungOrganizerTool,
  );
}
