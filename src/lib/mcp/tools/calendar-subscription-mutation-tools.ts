import {
  subscribeUserToSectionByJwId,
  unsubscribeUserFromSectionByJwId,
} from "@/features/home/server/subscriptions";
import { prisma } from "@/lib/db/prisma";
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

async function hasSubscribedSection(userId: string, jwId: number) {
  const existingSubscription = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscribedSections: {
        where: { jwId },
        select: { id: true },
      },
    },
  });
  return (existingSubscription?.subscribedSections.length ?? 0) > 0;
}

export async function subscribeSectionByJwIdTool(
  { jwId, locale, mode }: CalendarSubscriptionMutationArgs,
  extra: ToolExtra,
) {
  const resolvedMode = resolveMcpMode(mode);
  const userId = getUserId(extra.authInfo);
  const alreadySubscribed = await hasSubscribedSection(userId, jwId);
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
  const wasSubscribed = await hasSubscribedSection(userId, jwId);
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
