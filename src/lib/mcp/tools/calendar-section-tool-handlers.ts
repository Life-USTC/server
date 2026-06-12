import {
  getSubscribedSectionIds,
  getUserCalendarSubscription,
} from "@/features/home/server/subscription-read-model";
import { addUserSectionSubscriptions } from "@/features/home/server/subscriptions";
import type { AppLocale } from "@/i18n/config";
import {
  findSectionCodeMatches,
  findSectionCompactByJwId,
} from "@/lib/course-section-queries";
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

  const matches = await findSectionCodeMatches(codes, locale, semesterId);
  if (!matches) {
    return jsonToolResult({
      success: false,
      message: "No semester found",
    });
  }
  const matchedSections = matches.sections;

  const existingIdsBefore = new Set(await getSubscribedSectionIds(userId));
  const matchedIds = matchedSections.map((section) => section.id);
  const addedCount = matchedIds.filter(
    (id) => !existingIdsBefore.has(id),
  ).length;

  await addUserSectionSubscriptions(userId, matchedIds);
  const subscription = await getUserCalendarSubscription(userId, locale);

  return jsonToolResult(
    {
      success: true,
      semester: matches.semester,
      matchedCodes: matches.matchedCodes,
      unmatchedCodes: matches.unmatchedCodes,
      addedCount,
      alreadySubscribedCount: matchedIds.length - addedCount,
      subscription: subscription
        ? getCalendarSubscriptionMutationPayload(subscription, resolvedMode)
        : null,
    },
    { mode: resolvedMode === "full" ? "full" : "default" },
  );
}
