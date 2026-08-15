import type { AppLocale } from "@/i18n/config";
import { handleRouteError } from "@/lib/api/helpers";
import { schemaJsonResponse } from "@/lib/api/responses";
import { matchSectionCodesResponseSchema } from "@/lib/api/schemas/misc-response-schema-core";

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

  return schemaJsonResponse(matchSectionCodesResponseSchema, {
    semester: matches.semester,
    matchedCodes: matches.matchedCodes,
    unmatchedCodes: matches.unmatchedCodes,
    suggestions: matches.suggestions,
    sections: matches.sections,
    total: matches.total,
  });
}
