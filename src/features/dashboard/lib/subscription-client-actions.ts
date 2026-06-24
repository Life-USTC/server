import {
  appendSubscribedSectionIds,
  extractSubscriptionSectionCodes,
  matchSubscriptionSectionCodes,
  removeSubscribedSectionIds,
} from "@/features/home/lib/subscription-import-client";
import type {
  BulkImportCopy,
  MatchedSubscriptionSection,
  MatchSectionsResult,
} from "./subscription-types";

export async function matchSubscriptionSections(input: {
  copy: Pick<
    BulkImportCopy,
    "checkFormat" | "fetchFailed" | "noMatches" | "noValidCodes"
  >;
  semesterId: string;
  text: string;
}): Promise<MatchSectionsResult> {
  const codes = extractSubscriptionSectionCodes(input.text);
  if (codes.length === 0) {
    throw new Error(`${input.copy.noValidCodes}. ${input.copy.checkFormat}.`);
  }

  const payload = await matchSubscriptionSectionCodes({
    codes,
    fetchFailedMessage: input.copy.fetchFailed,
    semesterId: input.semesterId ? Number(input.semesterId) : undefined,
  });
  const sections = (payload.sections ?? []) as MatchedSubscriptionSection[];
  const unmatchedCodes = (payload.unmatchedCodes ?? []) as string[];
  return {
    sections,
    unmatchedCodes,
    message:
      sections.length === 0 && unmatchedCodes.length === 0
        ? input.copy.noMatches
        : "",
  };
}

export async function importSubscriptionSections(input: {
  copy: Pick<BulkImportCopy, "importFailed">;
  selectedSectionIds: number[];
}) {
  return appendSubscribedSectionIds({
    importFailedMessage: input.copy.importFailed,
    selectedSectionIds: input.selectedSectionIds,
  });
}

export async function removeSubscriptionSection(input: {
  errorMessage: string;
  sectionId: number;
}) {
  await removeSubscribedSectionIds({
    errorMessage: input.errorMessage,
    sectionIds: [input.sectionId],
  });
}
