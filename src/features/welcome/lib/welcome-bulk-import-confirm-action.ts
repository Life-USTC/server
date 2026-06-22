import { appendSubscribedSectionIds } from "@/features/home/lib/subscription-import-client";
import type { WelcomeBulkImportActionInput } from "./welcome-bulk-import-action-types";
import { resetWelcomeBulkImport } from "./welcome-bulk-import-reset-actions";

export async function confirmWelcomeBulkImport(
  input: WelcomeBulkImportActionInput,
) {
  const bulkCopy = input.getBulkCopy();
  input.setImporting(true);
  input.setImportError("");
  input.setImportMessage("");

  try {
    const selectedSectionIds = input.getSelectedSectionIds();
    const importedCount = await appendSubscribedSectionIds({
      importFailedMessage: bulkCopy.importFailed,
      selectedSectionIds,
    });
    input.setConfirmImportOpen(false);
    input.setBulkImportOpen(false);
    resetWelcomeBulkImport(input);
    input.setImportMessage(
      input.formatCopy(input.getWelcomeCopy().importedSummary, {
        count: importedCount,
        plural: input.getLocale() === "en-us" && importedCount !== 1 ? "s" : "",
      }),
    );
  } catch (error) {
    input.setImportError(
      error instanceof Error ? error.message : bulkCopy.importFailed,
    );
  } finally {
    input.setImporting(false);
  }
}
