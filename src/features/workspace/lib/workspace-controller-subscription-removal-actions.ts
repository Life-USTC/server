import type { WorkspaceSubscriptionActionInput } from "./workspace-controller-subscription-types";
import { removeWorkspaceSubscribedSection } from "./workspace-controller-subscriptions";

export function createWorkspaceSubscriptionRemovalActions(
  input: WorkspaceSubscriptionActionInput,
) {
  function clearPendingRemoveSection() {}

  async function removeSubscribedSection(sectionId: number) {
    input.setSubscriptionActionError("");

    input.setRemovingSectionId(sectionId);
    try {
      const message = await removeWorkspaceSubscribedSection({
        copy: input.getSubscriptionsCopy(),
        sectionId,
      });

      await input.invalidateAll();
      input.onSuccess?.(message);
      return true;
    } catch (error) {
      input.setSubscriptionActionError(
        error instanceof Error ? error.message : "",
      );
      return false;
    } finally {
      input.setRemovingSectionId(null);
    }
  }

  return {
    clearPendingRemoveSection,
    removeSubscribedSection,
  };
}
