import { getAssistantWorkspaceSnapshot } from "@/features/workspace/server/workspace-snapshot";
import type { AppLocale } from "@/i18n/config";
import {
  getUserId,
  parseOptionalMcpDate,
} from "@/lib/mcp/tools/_shared/helpers";

type ToolExtra = { authInfo?: Parameters<typeof getUserId>[0] };

export function parseOptionalWorkspaceAtTime(atTime: string | undefined) {
  return parseOptionalMcpDate("atTime", atTime, {
    dateOnlyAsShanghaiStart: true,
  });
}

export async function loadWorkspaceSnapshotForTool({
  atTime,
  extra,
  locale,
}: {
  atTime?: string;
  extra: ToolExtra;
  locale: AppLocale;
}) {
  const parsedAtTime = parseOptionalWorkspaceAtTime(atTime);
  if (!parsedAtTime.ok) return parsedAtTime;
  return {
    ok: true as const,
    snapshot: await getAssistantWorkspaceSnapshot({
      userId: getUserId(extra.authInfo),
      locale,
      atTime: parsedAtTime.value,
    }),
  };
}
