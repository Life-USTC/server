import { sectionCompactInclude } from "@/features/catalog/server/academic-query-includes";
import { resolveSectionCodeMatchSemester } from "@/features/catalog/server/section-code-match-semester";
import { buildSectionCodeSuggestions } from "@/features/catalog/server/section-code-match-suggestions";
import type { MatchedSectionCodes } from "@/features/catalog/server/section-code-match-types";
import type { AppLocale } from "@/i18n/config";
import { getPrisma } from "@/lib/db/prisma";
import { toSectionCompactDto } from "./academic-summary-dto-mappers";

export async function findSectionCodeMatches(
  codes: string[],
  locale: AppLocale = "zh-cn",
  semesterId?: number,
): Promise<MatchedSectionCodes | null> {
  const semester = await resolveSectionCodeMatchSemester(semesterId);

  if (!semester) {
    return null;
  }

  const sections = await getPrisma(locale).section.findMany({
    where: {
      code: { in: codes },
      retiredAt: null,
      semesterId: semester.id,
    },
    include: sectionCompactInclude,
    orderBy: [{ code: "asc" }, { jwId: "asc" }],
  });

  const sectionDtos = sections.map((section) =>
    toSectionCompactDto(section, locale),
  );
  const matchedCodes = sectionDtos.map((section) => section.code);
  const matchedCodeSet = new Set(matchedCodes);
  const unmatchedCodes = codes.filter((code) => !matchedCodeSet.has(code));
  const suggestions = await buildSectionCodeSuggestions({
    semesterId: semester.id,
    unmatchedCodes,
  });

  return {
    semester: {
      id: semester.id,
      nameCn: semester.nameCn,
      code: semester.code,
    },
    matchedCodes,
    unmatchedCodes,
    suggestions,
    sections: sectionDtos,
    total: sectionDtos.length,
  };
}
