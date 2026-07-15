import type { getUserCalendarSubscription } from "@/features/subscriptions/server/subscription-read-model";
import {
  summarizeCalendarSubscription,
  summarizeCalendarSubscriptionBrief,
} from "@/lib/mcp/tools/calendar-summary";

export function getCalendarSubscriptionReadPayload(
  subscription: NonNullable<
    Awaited<ReturnType<typeof getUserCalendarSubscription>>
  >,
  mode: "default" | "full",
) {
  if (mode === "full") {
    return {
      ...summarizeCalendarSubscription(subscription),
      ...subscription,
    };
  }
  return summarizeCalendarSubscription(subscription);
}

export function getCalendarSubscriptionMutationPayload(
  subscription: NonNullable<
    Awaited<ReturnType<typeof getUserCalendarSubscription>>
  >,
  mode: "default" | "full",
) {
  if (mode === "full") {
    return {
      ...summarizeCalendarSubscriptionBrief(subscription),
      ...subscription,
    };
  }
  return summarizeCalendarSubscriptionBrief(subscription);
}
