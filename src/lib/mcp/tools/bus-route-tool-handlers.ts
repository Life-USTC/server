import {
  getBusRouteTimetable,
  listBusRoutes,
  searchBusRoutes,
} from "@/features/bus/lib/bus-service";
import { jsonToolResult, resolveMcpMode } from "@/lib/mcp/tools/_helpers";
import type { BusLocale, McpModeInput } from "./bus-tool-types";

export async function listBusRoutesTool({ locale }: { locale: BusLocale }) {
  const result = await listBusRoutes(locale);
  return jsonToolResult(result, { mode: "default" });
}

export async function getBusRouteTimetableTool({
  routeId,
  versionKey,
  locale,
  mode,
}: {
  routeId: number;
  versionKey?: string;
  locale: BusLocale;
  mode?: McpModeInput;
}) {
  const result = await getBusRouteTimetable({
    routeId,
    locale,
    versionKey,
  });

  if (!result) {
    return jsonToolResult({
      routeId,
      hasData: false,
      message: `No timetable found for route ${routeId}. Use list_bus_routes to see available route IDs.`,
    });
  }

  return jsonToolResult(result, { mode: resolveMcpMode(mode) });
}

export async function searchBusRoutesTool({
  originCampusId,
  destinationCampusId,
  versionKey,
  locale,
  mode,
}: {
  originCampusId?: number;
  destinationCampusId?: number;
  versionKey?: string;
  locale: BusLocale;
  mode?: McpModeInput;
}) {
  const result = await searchBusRoutes({
    locale,
    originCampusId,
    destinationCampusId,
    versionKey,
  });

  return jsonToolResult(
    result ?? {
      hasData: false,
      message: "No bus schedule data available",
    },
    { mode: resolveMcpMode(mode) },
  );
}
