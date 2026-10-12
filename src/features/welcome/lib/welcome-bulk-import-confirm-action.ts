import { appendSubscribedSectionIds } from "@/features/subscriptions/lib/subscription-import-client";
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
    resetWelcomeBulkImport(input);
    input.setImportMessage(
      input.formatCopy(input.getWelcomeCopy().importedSummary, {
        count: importedCount,
        plural: input.getLocale() === "en-us" && importedCount !== 1 ? "s" : "",
      }),
    );
    // The same summary the subscriptions list shows, so welcome reports what
    // the import included rather than only that it succeeded.
    const subscriptionsCopy = input.getSubscriptionsCopy();
    input.setImportIncludedSummary(
      input.formatCopy(
        importedCount === 1
          ? subscriptionsCopy.sectionIncluded
          : subscriptionsCopy.sectionsIncluded,
        { count: importedCount },
      ),
    );
  } catch (error) {
    input.setImportError(
      error instanceof Error ? error.message : bulkCopy.importFailed,
    );
  } finally {
    input.setImporting(false);
  }
}
