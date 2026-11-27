import {
  appendSubscribedSectionIds,
  extractSubscriptionSectionCodes,
  matchSubscriptionSectionCodes,
} from "@/features/subscriptions/lib/subscription-import-client";
import { setSelectedSectionId } from "./welcome-bulk-import-selection";
import type { createWelcomeControllerDefaultState } from "./welcome-controller-default-state";
import { formatWelcomeCopy } from "./welcome-display";

export interface WelcomeBulkImportActionInput {
  state: ReturnType<typeof createWelcomeControllerDefaultState>;
  getLocale: () => string;
  getBulkCopy: () => Record<string, string>;
  getWelcomeCopy: () => Record<string, string>;
  getSubscriptionsCopy: () => {
    sectionIncluded: string;
    sectionsIncluded: string;
  };
}

export function createWelcomeBulkImportActions(
  input: WelcomeBulkImportActionInput,
) {
  const { state } = input;
  function setSectionSelection(sectionId: number, checked: boolean) {
    state.selectedSectionIds = setSelectedSectionId(
      state.selectedSectionIds,
      sectionId,
      checked,
    );
  }

  function resetBulkImport() {
    state.importText = "";
    state.importMessage = "";
    state.importIncludedSummary = "";
    state.importError = "";
    state.matchedSections = [];
    state.unmatchedCodes = [];
    state.selectedSectionIds = [];
    state.areResultsVisible = false;
  }

  async function matchSections() {
    const bulkCopy = input.getBulkCopy();
    const welcomeCopy = input.getWelcomeCopy();
    const codes = extractSubscriptionSectionCodes(state.importText);
    state.importMessage = "";
    state.importError = "";

    if (codes.length === 0) {
      state.importError = `${bulkCopy.noValidCodes}. ${bulkCopy.checkFormat}.`;
      return;
    }

    state.isMatching = true;
    try {
      const selectedSemesterId = state.selectedSemesterId;
      const payload = await matchSubscriptionSectionCodes({
        codes,
        fetchFailedMessage: bulkCopy.fetchFailed,
        semesterId: selectedSemesterId ? Number(selectedSemesterId) : undefined,
      });

      state.matchedSections = payload.sections;
      state.unmatchedCodes = payload.unmatchedCodes;
      state.selectedSectionIds = payload.sections.map((section) => section.id);
      if (
        payload.sections.length === 0 &&
        payload.unmatchedCodes.length === 0
      ) {
        state.importMessage = welcomeCopy.noMatchingSections;
      }
      state.areResultsVisible = true;
    } catch (error) {
      state.importError =
        error instanceof Error ? error.message : bulkCopy.fetchFailed;
    } finally {
      state.isMatching = false;
    }
  }

  async function confirmImport() {
    const bulkCopy = input.getBulkCopy();
    state.isImporting = true;
    state.importError = "";
    state.importMessage = "";

    try {
      const selectedSectionIds = state.selectedSectionIds;
      const importedCount = await appendSubscribedSectionIds({
        importFailedMessage: bulkCopy.importFailed,
        selectedSectionIds,
      });
      resetBulkImport();
      state.importMessage = formatWelcomeCopy(
        input.getWelcomeCopy().importedSummary,
        {
          count: importedCount,
          plural:
            input.getLocale() === "en-us" && importedCount !== 1 ? "s" : "",
        },
      );
      // The same summary the subscriptions list shows, so welcome reports what
      // the import included rather than only that it succeeded.
      const subscriptionsCopy = input.getSubscriptionsCopy();
      state.importIncludedSummary = formatWelcomeCopy(
        importedCount === 1
          ? subscriptionsCopy.sectionIncluded
          : subscriptionsCopy.sectionsIncluded,
        { count: importedCount },
      );
    } catch (error) {
      state.importError =
        error instanceof Error ? error.message : bulkCopy.importFailed;
    } finally {
      state.isImporting = false;
    }
  }

  return { setSectionSelection, resetBulkImport, matchSections, confirmImport };
}
