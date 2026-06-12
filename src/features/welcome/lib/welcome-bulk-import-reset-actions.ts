import type { WelcomeBulkImportActionInput } from "./welcome-bulk-import-action-types";

export function resetWelcomeBulkImport(input: WelcomeBulkImportActionInput) {
  input.setImportText("");
  input.setImportMessage("");
  input.setImportError("");
  input.setMatchedSections([]);
  input.setUnmatchedCodes([]);
  input.setSelectedSectionIds([]);
}
