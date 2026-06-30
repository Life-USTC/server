import { sectionCompactInclude } from "@/features/catalog/server/academic-query-includes";
import { resolveSectionCodeMatchSemester } from "@/features/catalog/server/section-code-match-semester";
import { buildSectionCodeSuggestions } from "@/features/catalog/server/section-code-match-suggestions";
import type { Prisma } from "@/generated/prisma/client";
import type { AppLocale } from "@/i18n/config";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { getPrisma } from "@/lib/db/prisma";
import { uniqueSectionIds } from "./subscription-section-id-helpers";

function uniqueCodes(codes: readonly string[] = []) {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const code of codes) {
    const trimmed = code.trim();
    if (!trimmed) continue;
    const normalized = normalizeCode(trimmed);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(trimmed);
  }
  return unique;
}

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

export async function resolveCalendarSubscriptionSections({
  codes = [],
  locale = DEFAULT_LOCALE,
  sectionIds = [],
  semesterId,
}: {
  codes?: readonly string[];
  locale?: AppLocale;
  sectionIds?: readonly number[];
  semesterId?: number;
}) {
  const requestedSectionIds = uniqueSectionIds(sectionIds);
  const requestedCodes = uniqueCodes(codes);
  const semester =
    requestedCodes.length > 0
      ? await resolveSectionCodeMatchSemester(semesterId)
      : null;

  if (requestedCodes.length > 0 && !semester) {
    return null;
  }

  const where: Prisma.SectionWhereInput[] = [];
  if (requestedSectionIds.length > 0) {
    where.push({ id: { in: requestedSectionIds } });
  }
  if (semester && requestedCodes.length > 0) {
    where.push({
      semesterId: semester.id,
      OR: requestedCodes.flatMap((code) => [
        { code: { equals: code, mode: "insensitive" } },
        { course: { code: { equals: code, mode: "insensitive" } } },
      ]),
    });
  }

  const localizedPrisma = getPrisma(locale);
  const sections =
    where.length === 0
      ? []
      : await localizedPrisma.section.findMany({
          where: where.length === 1 ? where[0] : { OR: where },
          include: sectionCompactInclude,
          orderBy: [
            { semester: { jwId: "desc" } },
            { code: "asc" },
            { jwId: "asc" },
          ],
        });

  const foundSectionIds = new Set(sections.map((section) => section.id));
  const requestedCodeByNormalized = new Map(
    requestedCodes.map((code) => [normalizeCode(code), code] as const),
  );
  const matchedCodeSet = new Set<string>();
  for (const section of sections) {
    const sectionCodeMatch = requestedCodeByNormalized.get(
      normalizeCode(section.code),
    );
    if (sectionCodeMatch) {
      matchedCodeSet.add(sectionCodeMatch);
    }
    const courseCodeMatch = requestedCodeByNormalized.get(
      normalizeCode(section.course.code),
    );
    if (courseCodeMatch) {
      matchedCodeSet.add(courseCodeMatch);
    }
  }

  const unmatchedCodes = requestedCodes.filter(
    (code) => !matchedCodeSet.has(code),
  );
  const suggestions =
    semester && unmatchedCodes.length > 0
      ? await buildSectionCodeSuggestions({
          semesterId: semester.id,
          unmatchedCodes,
        })
      : {};

  return {
    semester: semester
      ? { id: semester.id, nameCn: semester.nameCn, code: semester.code }
      : null,
    matchedCodes: requestedCodes.filter((code) => matchedCodeSet.has(code)),
    unmatchedCodes,
    matchedSectionIds: requestedSectionIds.filter((id) =>
      foundSectionIds.has(id),
    ),
    unmatchedSectionIds: requestedSectionIds.filter(
      (id) => !foundSectionIds.has(id),
    ),
    suggestions,
    sections,
    total: sections.length,
  };
}
