import type { resolveMcpMode } from "@/lib/mcp/tools/_helpers";

export function calendarSubscriptionMutationMode(
  mode: ReturnType<typeof resolveMcpMode>,
) {
  return mode === "full" ? "full" : "default";
}
