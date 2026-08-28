import { getNextBusDepartures } from "@/features/bus/server/bus-service";
import {
  jsonToolResult,
  parseOptionalMcpDate,
  resolveMcpMode,
} from "@/lib/mcp/tools/_shared/helpers";
import { summarizeNextBusDepartures } from "@/lib/mcp/tools/bus/bus-departure-summary";
import type {
  AtTimeInput,
  BusDayType,
  BusLocale,
  McpModeInput,
} from "./bus-tool-types";

export async function getNextBusesTool({
  originCampusId,
  destinationCampusId,
  atTime,
  dayType,
  includeDeparted,
  limit,
  versionKey,
  locale,
  mode,
}: {
  originCampusId: number;
  destinationCampusId: number;
  atTime?: AtTimeInput;
  dayType: BusDayType;
  includeDeparted: boolean;
  limit: number;
  versionKey?: string;
  locale: BusLocale;
  mode?: McpModeInput;
}) {
  const resolvedMode = resolveMcpMode(mode);
  const parsedAtTime = parseOptionalMcpDate("atTime", atTime);
  if (!parsedAtTime.ok) {
    return parsedAtTime.result;
  }

  const result = await getNextBusDepartures({
    locale,
    originCampusId,
    destinationCampusId,
    atTime: parsedAtTime.value?.toISOString(),
    dayType,
    includeDeparted,
    limit,
    versionKey,
  });

  if (result && resolvedMode !== "full") {
    return jsonToolResult(summarizeNextBusDepartures(result), {
      mode: resolvedMode,
    });
  }

  return jsonToolResult(
    result ?? {
      hasData: false,
      message: "No bus schedule data available",
    },
    { mode: resolvedMode },
  );
}
