import {
  hasUserSubscribedSectionByJwId,
  subscribeUserToSectionByJwId,
  unsubscribeUserFromSectionByJwId,
} from "@/features/home/server/subscriptions";
import {
  getUserId,
  jsonToolResult,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";
import { getCalendarSubscriptionMutationPayload } from "@/lib/mcp/tools/calendar-subscription-payload";
import { calendarSubscriptionMutationMode } from "./calendar-subscription-mode";
import type {
  CalendarSubscriptionMutationArgs,
  ToolExtra,
} from "./calendar-subscription-tool-types";

export async function subscribeSectionByJwIdTool(
  { jwId, locale, mode }: CalendarSubscriptionMutationArgs,
  extra: ToolExtra,
) {
  const resolvedMode = resolveMcpMode(mode);
  const userId = getUserId(extra.authInfo);
  const alreadySubscribed = await hasUserSubscribedSectionByJwId(userId, jwId);
  const subscription = await subscribeUserToSectionByJwId(userId, jwId, locale);

  return jsonToolResult(
    {
      success: Boolean(subscription),
      action: subscription
        ? alreadySubscribed
          ? "already_subscribed"
          : "subscribed"
        : "not_found",
      sectionJwId: jwId,
      subscription: subscription
        ? getCalendarSubscriptionMutationPayload(subscription, resolvedMode)
        : null,
    },
    { mode: calendarSubscriptionMutationMode(resolvedMode) },
  );
}

export async function unsubscribeSectionByJwIdTool(
  { jwId, locale, mode }: CalendarSubscriptionMutationArgs,
  extra: ToolExtra,
) {
  const resolvedMode = resolveMcpMode(mode);
  const userId = getUserId(extra.authInfo);
  const wasSubscribed = await hasUserSubscribedSectionByJwId(userId, jwId);
  const subscription = await unsubscribeUserFromSectionByJwId(
    userId,
    jwId,
    locale,
  );

  return jsonToolResult(
    {
      success: Boolean(subscription),
      action: subscription
        ? wasSubscribed
          ? "unsubscribed"
          : "not_subscribed"
        : "not_found",
      sectionJwId: jwId,
      subscription: subscription
        ? getCalendarSubscriptionMutationPayload(subscription, resolvedMode)
        : null,
    },
    { mode: calendarSubscriptionMutationMode(resolvedMode) },
  );
}
