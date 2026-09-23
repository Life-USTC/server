import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import { getWeatherSnapshot } from "@/features/weather/server/weather-service";
import type { WeatherLocationKey } from "@/features/weather/server/weather-types";
import {
  jsonToolResult,
  type McpModeInput,
  mcpModeInputSchema,
  resolveMcpMode,
} from "@/lib/mcp/tools/_shared/helpers";

const weatherLocationKeySchema = z
  .enum(["ustc-main", "ustc-gaoxin"])
  .default("ustc-main")
  .describe(
    "USTC campus location: ustc-main (main campus cluster, default) or ustc-gaoxin (Gaoxin campus).",
  );

async function getWeatherTool({
  locationKey,
  mode,
}: {
  locationKey: WeatherLocationKey;
  mode?: McpModeInput;
}) {
  const resolvedMode = resolveMcpMode(mode);
  const snapshot = await getWeatherSnapshot(locationKey);

  if (!snapshot) {
    return jsonToolResult(
      {
        locationKey,
        hasData: false,
        message: "No weather data available",
      },
      { mode: resolvedMode },
    );
  }

  if (resolvedMode === "full") {
    return jsonToolResult(snapshot, { mode: "full" });
  }

  const { extensions: _extensions, ...compactSnapshot } = snapshot;
  return jsonToolResult(compactSnapshot, { mode: "default" });
}

export function registerWeatherTools(server: McpServer) {
  server.registerTool(
    "catalog_weather_get",
    {
      description:
        "Current conditions, hourly precipitation forecast, daily highs/lows, and alerts for one USTC campus location, merged from Amap and Open-Meteo.",
      inputSchema: {
        locationKey: weatherLocationKeySchema,
        mode: mcpModeInputSchema,
      },
    },
    getWeatherTool,
  );
}
