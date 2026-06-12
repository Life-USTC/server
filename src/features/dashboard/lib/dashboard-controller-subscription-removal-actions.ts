import type { DashboardSubscriptionActionInput } from "./dashboard-controller-subscription-types";
import { removeDashboardSubscribedSection } from "./dashboard-controller-subscriptions";

export function createDashboardSubscriptionRemovalActions(
  input: DashboardSubscriptionActionInput,
) {
  let pendingRemoveTimer: ReturnType<typeof setTimeout> | null = null;

  function clearPendingRemoveSection() {
    if (pendingRemoveTimer) {
      clearTimeout(pendingRemoveTimer);
      pendingRemoveTimer = null;
    }
    input.setPendingRemoveSectionId(null);
  }

  function armPendingRemoveSection(sectionId: number) {
    clearPendingRemoveSection();
    input.setPendingRemoveSectionId(sectionId);
    pendingRemoveTimer = setTimeout(() => {
      if (input.getPendingRemoveSectionId() === sectionId) {
        input.setPendingRemoveSectionId(null);
      }
      pendingRemoveTimer = null;
    }, 4_000);
  }

  async function removeSubscribedSection(sectionId: number) {
    input.setSubscriptionActionMessage("");
    input.setSubscriptionActionError("");

    if (input.getPendingRemoveSectionId() !== sectionId) {
      armPendingRemoveSection(sectionId);
      return;
    }

    input.setRemovingSectionId(sectionId);
    try {
      const message = await removeDashboardSubscribedSection({
        copy: input.getSubscriptionsCopy(),
        sectionId,
      });

      clearPendingRemoveSection();
      await input.invalidateAll();
      input.setSubscriptionActionMessage(message);
    } catch (error) {
      input.setSubscriptionActionError(
        error instanceof Error ? error.message : "",
      );
    } finally {
      input.setRemovingSectionId(null);
    }
  }

  return {
    clearPendingRemoveSection,
    removeSubscribedSection,
  };
}
