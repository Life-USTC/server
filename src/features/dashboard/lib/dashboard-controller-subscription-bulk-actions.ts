import type { DashboardSubscriptionActionInput } from "./dashboard-controller-subscription-types";
import {
  confirmDashboardImportSections,
  defaultBulkImportSemesterId,
  matchDashboardImportSections,
  toggleSelectedImportSectionId,
} from "./dashboard-controller-subscriptions";
import { searchSubscriptionSections } from "./subscription-client-actions";

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
      return true;
    } catch (error) {
      input.setBulkImportError(error instanceof Error ? error.message : "");
      return false;
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

  async function searchQuickAddSections(inputValue: {
    semesterId: string;
    text: string;
  }) {
    const sections = await searchSubscriptionSections({
      errorMessage: input.getSubscriptionsCopy().bulkImport.fetchFailed,
      semesterId: inputValue.semesterId,
      text: inputValue.text,
    });

    return {
      message: "",
      sections,
      selectedSectionIds: sections.map((section) => section.id),
      unmatchedCodes: [],
    };
  }

  async function subscribeQuickAddSections(selectedSectionIds: number[]) {
    const message = await confirmDashboardImportSections({
      copy: input.getSubscriptionsCopy(),
      selectedSectionIds,
    });
    await input.invalidateAll();
    input.setBulkImportMessage(message);
  }

  return {
    confirmImportSections,
    matchImportSections,
    openBulkImportDialog,
    resetBulkImport,
    searchQuickAddSections,
    subscribeQuickAddSections,
    toggleImportSectionSelection,
  };
}
