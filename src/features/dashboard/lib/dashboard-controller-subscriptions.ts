import type { MatchedSection } from "./dashboard-controller-helpers";
import { formatMessage } from "./overview";
import {
  importSubscriptionSections,
  matchSubscriptionSections,
  removeSubscriptionSection,
} from "./subscriptions";

export type SubscriptionsCopy = {
  bulkImport: {
    checkFormat: string;
    fetchFailed: string;
    importFailed: string;
    noMatches: string;
    noValidCodes: string;
    successDescription: string;
  };
  optOutError: string;
  optOutSuccessDescription: string;
};

export function defaultBulkImportSemesterId(
  currentSemesterId: number | null | undefined,
  currentValue: string,
) {
  return currentValue || (currentSemesterId ? String(currentSemesterId) : "");
}

export function toggleSelectedImportSectionId(
  selectedIds: number[],
  sectionId: number,
) {
  const selectedIdSet = new Set(selectedIds);
  return selectedIdSet.has(sectionId)
    ? selectedIds.filter((id) => id !== sectionId)
    : [...selectedIds, sectionId];
}

export async function matchDashboardImportSections(input: {
  copy: SubscriptionsCopy;
  semesterId: string;
  text: string;
}): Promise<{
  message: string;
  sections: MatchedSection[];
  selectedSectionIds: number[];
  unmatchedCodes: string[];
}> {
  try {
    const result = await matchSubscriptionSections({
      copy: input.copy.bulkImport,
      semesterId: input.semesterId,
      text: input.text,
    });

    return {
      message: result.message,
      sections: result.sections,
      selectedSectionIds: result.sections.map((section) => section.id),
      unmatchedCodes: result.unmatchedCodes,
    };
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : input.copy.bulkImport.fetchFailed,
    );
  }
}

export async function confirmDashboardImportSections(input: {
  copy: SubscriptionsCopy;
  selectedSectionIds: number[];
}) {
  try {
    const importedCount = await importSubscriptionSections({
      copy: input.copy.bulkImport,
      selectedSectionIds: input.selectedSectionIds,
    });

    return formatMessage(input.copy.bulkImport.successDescription, {
      count: importedCount,
    });
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : input.copy.bulkImport.importFailed,
    );
  }
}

export async function removeDashboardSubscribedSection(input: {
  copy: SubscriptionsCopy;
  sectionId: number;
}) {
  try {
    await removeSubscriptionSection({
      errorMessage: input.copy.optOutError,
      sectionId: input.sectionId,
    });
    return input.copy.optOutSuccessDescription;
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : input.copy.optOutError,
    );
  }
}
