import {
  getUserCalendarSubscription,
  SECTION_SUBSCRIPTION_NOTE,
} from "@/features/home/server/subscription-read-model";
import {
  getUserId,
  jsonToolResult,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";
import { getCalendarSubscriptionReadPayload } from "@/lib/mcp/tools/calendar-subscription-payload";
import { calendarSubscriptionMutationMode } from "./calendar-subscription-mode";
import type {
  CalendarSubscriptionArgs,
  ToolExtra,
} from "./calendar-subscription-tool-types";

export async function getMyCalendarSubscriptionTool(
  { locale, mode }: CalendarSubscriptionArgs,
  extra: ToolExtra,
) {
  const resolvedMode = resolveMcpMode(mode);
  const userId = getUserId(extra.authInfo);
  const subscription = await getUserCalendarSubscription(userId, locale);
  if (!subscription) {
    return jsonToolResult({
      success: false,
      message: "User not found",
    });
  }

  return jsonToolResult(
    {
      success: true,
      subscription: getCalendarSubscriptionReadPayload(
        subscription,
        resolvedMode,
      ),
    },
    { mode: calendarSubscriptionMutationMode(resolvedMode) },
  );
}

export async function listMySubscribedSectionsTool(
  { locale, mode }: CalendarSubscriptionArgs,
  extra: ToolExtra,
) {
  const subscription = await getUserCalendarSubscription(
    getUserId(extra.authInfo),
    locale,
  );

  return jsonToolResult(
    {
      success: Boolean(subscription),
      sections: subscription?.sections ?? [],
      note: SECTION_SUBSCRIPTION_NOTE,
    },
    { mode: resolveMcpMode(mode) },
  );
}
