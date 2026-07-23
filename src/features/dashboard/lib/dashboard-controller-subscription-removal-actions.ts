import type { DashboardSubscriptionActionInput } from "./dashboard-controller-subscription-types";
import { removeDashboardSubscribedSection } from "./dashboard-controller-subscriptions";

export function createDashboardSubscriptionRemovalActions(
  input: DashboardSubscriptionActionInput,
) {
  function clearPendingRemoveSection() {}

  async function removeSubscribedSection(sectionId: number) {
    input.setSubscriptionActionMessage("");
    input.setSubscriptionActionError("");

    input.setRemovingSectionId(sectionId);
    try {
      const message = await removeDashboardSubscribedSection({
        copy: input.getSubscriptionsCopy(),
        sectionId,
      });

      await input.invalidateAll();
      input.setSubscriptionActionMessage(message);
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
