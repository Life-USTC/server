import { getSubscribedSectionIds } from "@/features/home/server/subscription-read-model";
import {
  getTodayBounds,
  getUserId,
  getViewerInfo,
  jsonToolResult,
  parseOptionalMcpDate,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";
import {
  buildMyOverviewFullPayload,
  buildMyOverviewSummaryPayload,
  loadMyOverviewCounts,
  loadMyOverviewSamples,
} from "./my-data-overview-payload";

type McpMode = "summary" | "default" | "full";
type ToolExtra = { authInfo?: Parameters<typeof getUserId>[0] };

export async function getMyOverviewAction(
  { locale, atTime, mode }: { locale: string; atTime?: string; mode?: McpMode },
  extra: ToolExtra,
) {
  const resolvedMode = resolveMcpMode(mode);
  const userId = getUserId(extra.authInfo);
  const user = await getViewerInfo(userId);
  const sectionIds = await getSubscribedSectionIds(userId);
  const atTimeDate = parseOptionalMcpDate("atTime", atTime);
  if (!atTimeDate.ok) {
    return atTimeDate.result;
  }
  const { now, todayStart, tomorrowStart } = getTodayBounds(atTimeDate.value);
  const counts = await loadMyOverviewCounts({
    sectionIds,
    todayStart,
    tomorrowStart,
    userId,
  });
  const samples = await loadMyOverviewSamples({
    locale,
    now,
    sectionIds,
    userId,
  });

  if (resolvedMode === "summary") {
    return jsonToolResult(
      buildMyOverviewSummaryPayload({ counts, samples, user }),
      { mode: "default" },
    );
  }

  return jsonToolResult(buildMyOverviewFullPayload({ counts, samples, user }), {
    mode: resolvedMode,
  });
}
