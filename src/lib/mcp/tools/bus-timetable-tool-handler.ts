import { getBusTimetableData } from "@/features/bus/lib/bus-service";
import {
  getUserId,
  jsonToolResult,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";
import {
  summarizeBusTimetable,
  summarizeBusTimetableBrief,
} from "@/lib/mcp/tools/bus-tool-summary";
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

  if (result && resolvedMode === "summary") {
    return jsonToolResult(summarizeBusTimetableBrief(result), {
      mode: "default",
    });
  }

  if (result && resolvedMode === "default") {
    return jsonToolResult(summarizeBusTimetable(result), {
      mode: "default",
    });
  }

  return jsonToolResult(
    result ?? {
      locale,
      hasData: false,
      message: "No bus schedule data available",
    },
    {
      mode: resolvedMode,
    },
  );
}
