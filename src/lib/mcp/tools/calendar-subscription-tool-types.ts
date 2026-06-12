import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { getUserCalendarSubscription } from "@/features/home/server/subscription-read-model";
import type { resolveMcpMode } from "@/lib/mcp/tools/_helpers";

export type ToolExtra = { authInfo?: AuthInfo };
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
