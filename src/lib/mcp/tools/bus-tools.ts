import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {
  flexDateInputSchema,
  mcpLocaleInputSchema,
  mcpModeInputSchema,
} from "@/lib/mcp/tools/_helpers";
import {
  getBusRouteTimetableTool,
  getMyBusPreferencesTool,
  getNextBusesTool,
  listBusRoutesTool,
  queryBusTimetableTool,
  saveMyBusPreferencesTool,
  searchBusRoutesTool,
} from "@/lib/mcp/tools/bus-tool-handlers";

const busDayTypeSchema = z.enum(["auto", "weekday", "weekend"]).default("auto");
const busPreferenceCampusIdSchema = z
  .number()
  .int()
  .positive()
  .nullable()
  .default(null);

export function registerBusTools(server: McpServer) {
  server.registerTool(
    "catalog_bus_timetable_get",
    {
      description:
        "Full USTC shuttle bus dataset for clients that need local filtering. Prefer catalog_bus_departure_next for departures or catalog_bus_route_list for discovery.",
      inputSchema: {
        versionKey: z.string().trim().min(1).optional(),
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    queryBusTimetableTool,
  );

  server.registerTool(
    "catalog_bus_route_list",
    {
      description:
        "Route and campus discovery for the active shuttle timetable. Use returned route IDs with catalog_bus_route_get.",
      inputSchema: {
        locale: mcpLocaleInputSchema,
      },
    },
    listBusRoutesTool,
  );

  server.registerTool(
    "catalog_bus_route_get",
    {
      description:
        "Full weekday/weekend timetable for one route ID. Use catalog_bus_route_list first to find route IDs.",
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
    "workspace_bus_preferences_get",
    {
      description:
        "Read the authenticated user's saved shuttle bus preferences.",
      inputSchema: {
        mode: mcpModeInputSchema,
      },
    },
    getMyBusPreferencesTool,
  );

  server.registerTool(
    "workspace_bus_preferences_set",
    {
      description:
        "Save the authenticated user's preferred shuttle bus campuses and show-departed setting.",
      inputSchema: {
        preferredOriginCampusId: busPreferenceCampusIdSchema,
        preferredDestinationCampusId: busPreferenceCampusIdSchema,
        showDepartedTrips: z.boolean(),
        mode: mcpModeInputSchema,
      },
    },
    saveMyBusPreferencesTool,
  );

  server.registerTool(
    "catalog_bus_route_search",
    {
      description:
        "Find shuttle routes by optional origin/destination campus IDs. Use catalog_bus_departure_next when the user asks when to leave.",
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
    "catalog_bus_departure_next",
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
        limit: z.number().int().min(1).max(50).default(5),
        versionKey: z.string().trim().min(1).optional(),
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    getNextBusesTool,
  );
}
