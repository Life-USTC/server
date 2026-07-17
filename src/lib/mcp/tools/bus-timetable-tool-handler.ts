import { getBusTimetableData } from "@/features/bus/server/bus-service";
import {
  getUserId,
  jsonToolResult,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";
import {
  buildFullBusTimetable,
  summarizeBusTimetable,
} from "@/lib/mcp/tools/bus-timetable-summary";
import type { BusLocale, McpModeInput, ToolExtra } from "./bus-tool-types";

export async function queryBusTimetableTool(
  {
    versionKey,
    locale,
    mode,
  }: { versionKey?: string; locale: BusLocale; mode?: McpModeInput },
  extra: ToolExtra,
) {
  const resolvedMode = resolveMcpMode(mode);
  const result = await getBusTimetableData({
    locale,
    versionKey,
    userId: getUserId(extra.authInfo),
  });

  if (result && resolvedMode === "default") {
    return jsonToolResult(summarizeBusTimetable(result), {
      mode: "default",
    });
  }

  if (result) {
    return jsonToolResult(buildFullBusTimetable(result), { mode: "full" });
  }

  return jsonToolResult(
    {
      locale,
      hasData: false,
      message: "No bus schedule data available",
    },
    {
      mode: resolvedMode,
    },
  );
}
