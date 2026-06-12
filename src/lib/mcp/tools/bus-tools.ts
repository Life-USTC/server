import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {
  flexDateInputSchema,
  mcpLocaleInputSchema,
  mcpModeInputSchema,
} from "@/lib/mcp/tools/_helpers";
import {
  getBusRouteTimetableTool,
  getNextBusesTool,
  listBusRoutesTool,
  queryBusTimetableTool,
  searchBusRoutesTool,
} from "@/lib/mcp/tools/bus-tool-handlers";

const busDayTypeSchema = z.enum(["auto", "weekday", "weekend"]).default("auto");

export function registerBusTools(server: McpServer) {
  server.registerTool(
    "query_bus_timetable",
    {
      description:
        "Full USTC shuttle bus dataset for clients that need local filtering. Prefer get_next_buses for departures or list_bus_routes for discovery.",
      inputSchema: {
        versionKey: z.string().trim().min(1).optional(),
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    queryBusTimetableTool,
  );

  server.registerTool(
    "list_bus_routes",
    {
      description:
        "Route and campus discovery for the active shuttle timetable. Use returned route IDs with get_bus_route_timetable.",
      inputSchema: {
        locale: mcpLocaleInputSchema,
      },
    },
    listBusRoutesTool,
  );

  server.registerTool(
    "get_bus_route_timetable",
    {
      description:
        "Full weekday/weekend timetable for one route ID. Use list_bus_routes first to find route IDs.",
      inputSchema: {
        routeId: z.number().int().positive(),
        versionKey: z.string().trim().min(1).optional(),
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    getBusRouteTimetableTool,
  );

  server.registerTool(
    "search_bus_routes",
    {
      description:
        "Find shuttle routes by optional origin/destination campus IDs. Use get_next_buses when the user asks when to leave.",
      inputSchema: {
        originCampusId: z.number().int().positive().optional(),
        destinationCampusId: z.number().int().positive().optional(),
        versionKey: z.string().trim().min(1).optional(),
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    searchBusRoutesTool,
  );

  server.registerTool(
    "get_next_buses",
    {
      description:
        "Next shuttle departures between two campuses. Best tool for 'when is the next bus?' questions.",
      inputSchema: {
        originCampusId: z.number().int().positive(),
        destinationCampusId: z.number().int().positive(),
        atTime: flexDateInputSchema
          .optional()
          .describe(
            "Anchor the departure query to this moment instead of the server clock. Accepts YYYY-MM-DD or ISO 8601 with offset.",
          ),
        dayType: busDayTypeSchema,
        includeDeparted: z.boolean().default(false),
        limit: z.number().int().min(1).max(20).default(5),
        versionKey: z.string().trim().min(1).optional(),
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    getNextBusesTool,
  );
}
