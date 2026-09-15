import { createWorkspaceBulkImportActions } from "./workspace-controller-subscription-bulk-actions";
import { createWorkspaceSubscriptionRemovalActions } from "./workspace-controller-subscription-removal-actions";
import type { WorkspaceSubscriptionActionInput } from "./workspace-controller-subscription-types";

export function createWorkspaceSubscriptionActions(
  input: WorkspaceSubscriptionActionInput,
) {
  return {
    ...createWorkspaceSubscriptionRemovalActions(input),
    ...createWorkspaceBulkImportActions(input),
  };
}
