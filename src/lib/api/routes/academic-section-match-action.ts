import type { AppLocale } from "@/i18n/config";
import { handleRouteError, jsonResponse } from "@/lib/api/helpers";

export async function matchSectionCodesAction(
  codes: readonly string[],
  locale: AppLocale,
  parsedSemesterId?: number,
) {
  const { findSectionCodeMatches } = await import(
    "@/features/catalog/server/course-section-queries"
  );
  const matches = await findSectionCodeMatches(
    Array.from(codes),
    locale,
    parsedSemesterId,
  );

  if (!matches) {
    return handleRouteError("No semester found", new Error("No semester"), 404);
  }

  return jsonResponse({
    semester: matches.semester,
    matchedCodes: matches.matchedCodes,
    unmatchedCodes: matches.unmatchedCodes,
    suggestions: matches.suggestions,
    sections: matches.sections,
    total: matches.total,
  });
}
