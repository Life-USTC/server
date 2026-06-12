import {
  extractSectionCodes,
  matchWelcomeSectionCodes,
} from "@/features/welcome/lib/welcome-bulk-import-client";
import type { WelcomeBulkImportActionInput } from "./welcome-bulk-import-action-types";

export async function matchWelcomeBulkImportSections(
  input: WelcomeBulkImportActionInput,
) {
  const bulkCopy = input.getBulkCopy();
  const welcomeCopy = input.getWelcomeCopy();
  const codes = extractSectionCodes(input.getImportText());
  input.setImportMessage("");
  input.setImportError("");

  if (codes.length === 0) {
    input.setImportError(`${bulkCopy.noValidCodes}. ${bulkCopy.checkFormat}.`);
    return;
  }

  input.setMatching(true);
  try {
    const selectedSemesterId = input.getSelectedSemesterId();
    const payload = await matchWelcomeSectionCodes({
      codes,
      fetchFailedMessage: bulkCopy.fetchFailed,
      semesterId: selectedSemesterId ? Number(selectedSemesterId) : undefined,
    });

    input.setMatchedSections(payload.sections);
    input.setUnmatchedCodes(payload.unmatchedCodes);
    input.setSelectedSectionIds(payload.sections.map((section) => section.id));
    if (payload.sections.length === 0 && payload.unmatchedCodes.length === 0) {
      input.setImportMessage(welcomeCopy.noMatchingSections);
    }
    input.setConfirmImportOpen(true);
  } catch (error) {
    input.setImportError(
      error instanceof Error ? error.message : bulkCopy.fetchFailed,
    );
  } finally {
    input.setMatching(false);
  }
}
