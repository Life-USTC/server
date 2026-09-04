import { createDashboardBulkImportActions } from "./dashboard-controller-subscription-bulk-actions";
import { createDashboardSubscriptionRemovalActions } from "./dashboard-controller-subscription-removal-actions";
import type { DashboardSubscriptionActionInput } from "./dashboard-controller-subscription-types";

export function createDashboardSubscriptionActions(
  input: DashboardSubscriptionActionInput,
) {
  return {
    ...createDashboardSubscriptionRemovalActions(input),
    ...createDashboardBulkImportActions(input),
  };
}
