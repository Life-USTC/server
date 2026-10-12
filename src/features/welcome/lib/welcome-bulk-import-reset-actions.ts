import type { WelcomeBulkImportActionInput } from "./welcome-bulk-import-action-types";

export function resetWelcomeBulkImport(input: WelcomeBulkImportActionInput) {
  input.setImportText("");
  input.setImportMessage("");
  input.setImportIncludedSummary("");
  input.setImportError("");
  input.setMatchedSections([]);
  input.setUnmatchedCodes([]);
  input.setSelectedSectionIds([]);
  input.setResultsVisible(false);
}
