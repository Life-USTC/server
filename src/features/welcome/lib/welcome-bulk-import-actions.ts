import {
  setSelectedSectionId,
  toggleSelectedSectionId,
} from "@/features/welcome/lib/welcome-bulk-import-selection";
import type { WelcomeBulkImportActionInput } from "./welcome-bulk-import-action-types";
import { confirmWelcomeBulkImport } from "./welcome-bulk-import-confirm-action";
import { matchWelcomeBulkImportSections } from "./welcome-bulk-import-match-action";
import { resetWelcomeBulkImport } from "./welcome-bulk-import-reset-actions";

export function createWelcomeBulkImportActions(
  input: WelcomeBulkImportActionInput,
) {
  function resetBulkImport() {
    resetWelcomeBulkImport(input);
  }

  function toggleSectionSelection(sectionId: number) {
    input.setSelectedSectionIds(
      toggleSelectedSectionId(
        input.getSelectedSectionIds(),
        input.getSelectedSectionIdSet(),
        sectionId,
      ),
    );
  }

  function setSectionSelection(sectionId: number, checked: boolean) {
    input.setSelectedSectionIds(
      setSelectedSectionId(input.getSelectedSectionIds(), sectionId, checked),
    );
  }

  async function matchSections() {
    await matchWelcomeBulkImportSections(input);
  }

  async function confirmImport() {
    await confirmWelcomeBulkImport(input);
  }

  return {
    confirmImport,
    resetBulkImport,
    setSectionSelection,
    toggleSectionSelection,
    matchSections,
  };
}
