import { apiClient, apiErrorMessage } from "@/lib/api/client";
import type { SubscriptionKind } from "./subscription-kind";

export async function saveSubscriptionKind(
  jwId: number,
  kind: SubscriptionKind,
  errorMessage: string,
) {
  const result = await apiClient.PATCH(`/api/workspace/subscriptions/${jwId}`, {
    body: { kind },
  });
  if (!result.response.ok)
    throw new Error(apiErrorMessage(result, errorMessage));
}
