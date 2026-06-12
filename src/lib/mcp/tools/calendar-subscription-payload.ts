import type { getUserCalendarSubscription } from "@/features/home/server/subscription-read-model";
import {
  summarizeCalendarSubscription,
  summarizeCalendarSubscriptionBrief,
} from "@/lib/mcp/tools/calendar-summary";

export function getCalendarSubscriptionReadPayload(
  subscription: NonNullable<
    Awaited<ReturnType<typeof getUserCalendarSubscription>>
  >,
  mode: "summary" | "default" | "full",
) {
  if (mode === "full") {
    return subscription;
  }
  if (mode === "summary") {
    return summarizeCalendarSubscriptionBrief(subscription);
  }
  return summarizeCalendarSubscription(subscription);
}

export function getCalendarSubscriptionMutationPayload(
  subscription: NonNullable<
    Awaited<ReturnType<typeof getUserCalendarSubscription>>
  >,
  mode: "summary" | "default" | "full",
) {
  if (mode === "full") {
    return subscription;
  }
  return summarizeCalendarSubscriptionBrief(subscription);
}
