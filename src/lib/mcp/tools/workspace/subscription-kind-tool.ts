import type { SubscriptionKind } from "@/features/subscriptions/lib/subscription-kind";
import { updateSubscriptionKind } from "@/features/subscriptions/server/subscription-kind";
import { getUserId, jsonToolResult } from "@/lib/mcp/tools/_shared/helpers";
import type { ToolExtra } from "./calendar-subscription-tool-types";

export async function updateSubscriptionKindTool(
  args: { jwId: number; kind: SubscriptionKind },
  extra: ToolExtra,
) {
  const result = await updateSubscriptionKind({
    userId: getUserId(extra.authInfo),
    sectionJwId: args.jwId,
    kind: args.kind,
  });
  return jsonToolResult(
    result
      ? { success: true, ...result }
      : { success: false, message: "Subscription not found" },
  );
}
