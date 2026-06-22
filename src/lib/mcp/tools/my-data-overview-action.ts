import { getCompactOverview } from "@/features/home/server/compact-overview-read-model";
import { DEFAULT_LOCALE, isAppLocale } from "@/i18n/config";
import {
  getUserId,
  jsonToolResult,
  type McpModeInput,
  parseOptionalMcpDate,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";
import {
  buildMyOverviewFullPayload,
  buildMyOverviewSummaryPayload,
} from "./my-data-overview-response";

type ToolExtra = { authInfo?: Parameters<typeof getUserId>[0] };

export async function getMyOverviewAction(
  {
    locale,
    atTime,
    mode,
  }: { locale: string; atTime?: string; mode?: McpModeInput },
  extra: ToolExtra,
) {
  const resolvedMode = resolveMcpMode(mode);
  const userId = getUserId(extra.authInfo);
  const atTimeDate = parseOptionalMcpDate("atTime", atTime);
  if (!atTimeDate.ok) {
    return atTimeDate.result;
  }

  const overview = await getCompactOverview(userId, {
    ...(atTimeDate.value ? { atTime: atTimeDate.value } : {}),
    locale: isAppLocale(locale) ? locale : DEFAULT_LOCALE,
  });

  if (resolvedMode === "summary") {
    return jsonToolResult(buildMyOverviewSummaryPayload(overview), {
      mode: "default",
    });
  }

  return jsonToolResult(buildMyOverviewFullPayload(overview), {
    mode: resolvedMode,
  });
}
