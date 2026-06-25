import { findSectionCompactByJwId } from "@/features/catalog/server/course-section-queries";
import { importUserSectionSubscriptionsByCodes } from "@/features/subscriptions/server/subscriptions";
import type { AppLocale } from "@/i18n/config";
import {
  getUserId,
  jsonToolResult,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";
import { getCalendarSubscriptionMutationPayload } from "@/lib/mcp/tools/calendar-subscription-payload";
import { getPublicOrigin } from "@/lib/site-url";

type McpModeInput = Parameters<typeof resolveMcpMode>[0];

export async function getSectionCalendarSubscriptionTool({
  jwId,
  locale,
  mode,
}: {
  jwId: number;
  locale: AppLocale;
  mode?: McpModeInput;
}) {
  const section = await findSectionCompactByJwId(jwId, locale);

  return jsonToolResult(
    {
      found: Boolean(section),
      section,
      calendarPath: `/api/sections/${jwId}/calendar.ics`,
      calendarUrl: `${getPublicOrigin()}/api/sections/${jwId}/calendar.ics`,
    },
    { mode: resolveMcpMode(mode) },
  );
}

export async function subscribeMySectionsByCodesTool(
  {
    codes,
    semesterId,
    locale,
    mode,
  }: {
    codes: string[];
    semesterId?: number;
    locale: AppLocale;
    mode?: McpModeInput;
  },
  extra: { authInfo?: Parameters<typeof getUserId>[0] },
) {
  const resolvedMode = resolveMcpMode(mode);
  const userId = getUserId(extra.authInfo);

  const result = await importUserSectionSubscriptionsByCodes({
    codes,
    locale,
    semesterId,
    userId,
  });
  if (!result) {
    return jsonToolResult({
      success: false,
      message: "No semester found",
    });
  }
  const { alreadySubscribedSections, addedSections, matches, subscription } =
    result;

  return jsonToolResult(
    {
      success: true,
      semester: matches.semester,
      matchedCodes: matches.matchedCodes,
      unmatchedCodes: matches.unmatchedCodes,
      addedCount: addedSections.length,
      alreadySubscribedCount: alreadySubscribedSections.length,
      subscription: subscription
        ? getCalendarSubscriptionMutationPayload(subscription, resolvedMode)
        : null,
    },
    { mode: resolvedMode === "full" ? "full" : "default" },
  );
}
