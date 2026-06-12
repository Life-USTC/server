import {
  fetchCurrentSubscriptionSectionIds,
  parseSubscriptionResponse,
  updateSubscriptionSectionIds,
} from "./subscription-http-client";
import { extractSectionCodes } from "./subscription-section-utils";
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
  const codes = extractSectionCodes(input.text);
  if (codes.length === 0) {
    throw new Error(`${input.copy.noValidCodes}. ${input.copy.checkFormat}.`);
  }

  const response = await fetch("/api/sections/match-codes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      codes,
      semesterId: input.semesterId ? Number(input.semesterId) : undefined,
    }),
  });
  const payload = await parseSubscriptionResponse(response);
  if (!response.ok) {
    throw new Error(payload?.error ?? input.copy.fetchFailed);
  }

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
  copy: Pick<BulkImportCopy, "fetchFailed" | "importFailed">;
  selectedSectionIds: number[];
}) {
  const currentSectionIds = await fetchCurrentSubscriptionSectionIds(
    input.copy.fetchFailed,
  );
  const nextSectionIds = Array.from(
    new Set([...currentSectionIds, ...input.selectedSectionIds]),
  );

  await updateSubscriptionSectionIds(nextSectionIds, input.copy.importFailed);

  return input.selectedSectionIds.length;
}

export async function removeSubscriptionSection(input: {
  errorMessage: string;
  sectionId: number;
}) {
  const currentSectionIds = await fetchCurrentSubscriptionSectionIds(
    input.errorMessage,
  );
  const nextSectionIds = currentSectionIds.filter(
    (currentSectionId: number) => currentSectionId !== input.sectionId,
  );

  await updateSubscriptionSectionIds(nextSectionIds, input.errorMessage);
}
