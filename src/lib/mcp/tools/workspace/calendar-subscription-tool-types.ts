import type { AuthInfo } from "@modelcontextprotocol/server";
import type { getUserCalendarSubscription } from "@/features/subscriptions/server/subscription-read-model";
import type { resolveMcpMode } from "@/lib/mcp/tools/_shared/helpers";

export type ToolExtra = { http?: { authInfo?: AuthInfo } };
export type CalendarSubscriptionLocale = Parameters<
  typeof getUserCalendarSubscription
>[1];
export type McpModeInput = Parameters<typeof resolveMcpMode>[0];
export type CalendarSubscriptionArgs = {
  locale: CalendarSubscriptionLocale;
  mode?: McpModeInput;
};
export type CalendarSubscriptionMutationArgs = CalendarSubscriptionArgs & {
  jwId: number;
};
