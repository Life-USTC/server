import type { DashboardSubscriptionActionInput } from "./dashboard-controller-subscription-types";
import {
  confirmDashboardImportSections,
  defaultBulkImportSemesterId,
  matchDashboardImportSections,
  toggleSelectedImportSectionId,
} from "./dashboard-controller-subscriptions";

export function createDashboardBulkImportActions(
  input: DashboardSubscriptionActionInput,
) {
  function resetBulkImport() {
    input.setBulkImportText("");
    input.setBulkImportMessage("");
    input.setBulkImportError("");
    input.setMatchedSections([]);
    input.setUnmatchedSectionCodes([]);
    input.setSelectedImportSectionIds([]);
  }

  function openBulkImportDialog() {
    input.setBulkImportSemesterId(
      defaultBulkImportSemesterId(
        input.getCurrentSemesterId(),
        input.getBulkImportSemesterId(),
      ),
    );
    input.setBulkImportOpen(true);
  }

  function toggleImportSectionSelection(sectionId: number) {
    input.setSelectedImportSectionIds(
      toggleSelectedImportSectionId(
        input.getSelectedImportSectionIds(),
        sectionId,
      ),
    );
  }

  async function matchImportSections() {
    input.setBulkImportMessage("");
    input.setBulkImportError("");
    input.setMatchingSections(true);

    try {
      const result = await matchDashboardImportSections({
        copy: input.getSubscriptionsCopy(),
        semesterId: input.getBulkImportSemesterId(),
        text: input.getBulkImportText(),
      });

      input.setMatchedSections(result.sections);
      input.setUnmatchedSectionCodes(result.unmatchedCodes);
      input.setSelectedImportSectionIds(result.selectedSectionIds);
      input.setBulkImportMessage(result.message);
      input.setBulkImportOpen(false);
      input.setConfirmImportOpen(true);
    } catch (error) {
      input.setBulkImportError(error instanceof Error ? error.message : "");
    } finally {
      input.setMatchingSections(false);
    }
  }

  async function confirmImportSections() {
    input.setImportingSections(true);
    input.setBulkImportError("");
    input.setBulkImportMessage("");

    try {
      const message = await confirmDashboardImportSections({
        copy: input.getSubscriptionsCopy(),
        selectedSectionIds: input.getSelectedImportSectionIds(),
      });

      input.setConfirmImportOpen(false);
      input.setBulkImportOpen(false);
      resetBulkImport();
      await input.invalidateAll();
      input.setBulkImportMessage(message);
    } catch (error) {
      input.setBulkImportError(error instanceof Error ? error.message : "");
    } finally {
      input.setImportingSections(false);
    }
  }

  return {
    confirmImportSections,
    matchImportSections,
    openBulkImportDialog,
    resetBulkImport,
    toggleImportSectionSelection,
  };
}
