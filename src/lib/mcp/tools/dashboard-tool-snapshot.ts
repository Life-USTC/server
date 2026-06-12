import { getAssistantDashboardSnapshot } from "@/features/home/server/assistant-dashboard-snapshot";
import type { AppLocale } from "@/i18n/config";
import { getUserId, parseOptionalMcpDate } from "@/lib/mcp/tools/_helpers";

type ToolExtra = { authInfo?: Parameters<typeof getUserId>[0] };

export function parseOptionalDashboardAtTime(atTime: string | undefined) {
  return parseOptionalMcpDate("atTime", atTime, {
    dateOnlyAsShanghaiStart: true,
  });
}

export async function loadDashboardSnapshotForTool({
  atTime,
  extra,
  locale,
}: {
  atTime?: string;
  extra: ToolExtra;
  locale: AppLocale;
}) {
  const parsedAtTime = parseOptionalDashboardAtTime(atTime);
  if (!parsedAtTime.ok) return parsedAtTime;
  return {
    ok: true as const,
    snapshot: await getAssistantDashboardSnapshot({
      userId: getUserId(extra.authInfo),
      locale,
      atTime: parsedAtTime.value,
    }),
  };
}
