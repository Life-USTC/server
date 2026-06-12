import { handleRouteError, jsonResponse } from "@/lib/api/helpers";

export async function matchSectionCodesAction(
  codes: readonly string[],
  parsedSemesterId?: number,
) {
  const { findSectionCodeMatches } = await import(
    "@/lib/course-section-queries"
  );
  const matches = await findSectionCodeMatches(
    Array.from(codes),
    "zh-cn",
    parsedSemesterId,
  );

  if (!matches) {
    return handleRouteError("No semester found", new Error("No semester"), 404);
  }

  return jsonResponse({
    semester: matches.semester,
    matchedCodes: matches.matchedCodes,
    unmatchedCodes: matches.unmatchedCodes,
    sections: matches.sections,
    total: matches.total,
  });
}
