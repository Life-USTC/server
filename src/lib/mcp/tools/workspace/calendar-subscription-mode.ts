import type { resolveMcpMode } from "@/lib/mcp/tools/_shared/helpers";

export function calendarSubscriptionMutationMode(
  mode: ReturnType<typeof resolveMcpMode>,
) {
  return mode === "full" ? "full" : "default";
}
