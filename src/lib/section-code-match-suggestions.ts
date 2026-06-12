import { prisma } from "@/lib/db/prisma";
import {
  extractCodePrefixes,
  findClosestMatches,
  normalizeFuzzyValue,
} from "@/lib/fuzzy-match";
import { ilike } from "@/lib/query-helpers";

function normalizeSemesterCodes(semesterCodes: string[]) {
  return semesterCodes.map((code: string) => ({
    code,
    normalized: normalizeFuzzyValue(code),
  }));
}

export async function buildSectionCodeSuggestions({
  semesterId,
  unmatchedCodes,
}: {
  semesterId: number;
  unmatchedCodes: string[];
}) {
  const unmatchedCodePrefixes = new Map(
    unmatchedCodes.map((code) => [code, extractCodePrefixes(code)] as const),
  );
  const batchedPrefixes = Array.from(
    new Set(Array.from(unmatchedCodePrefixes.values()).flat()),
  ).slice(0, 40);
  const semesterCodes: string[] =
    batchedPrefixes.length > 0
      ? (
          await prisma.section.findMany({
            where: {
              semesterId,
              OR: batchedPrefixes.map((prefix) => ({
                code: ilike(prefix),
              })),
            },
            select: { code: true },
            orderBy: [{ code: "asc" }],
            take: 1500,
          })
        ).map((section: { code: string }) => section.code)
      : [];
  const normalizedSemesterCodes = normalizeSemesterCodes(semesterCodes);
  const prefixMatches = new Map<string, string[]>(
    batchedPrefixes.map((prefix) => [
      prefix,
      normalizedSemesterCodes
        .filter((section: { code: string; normalized: string }) =>
          section.normalized.includes(prefix),
        )
        .map((section: { code: string; normalized: string }) => section.code),
    ]),
  );
  const suggestionEntries = unmatchedCodes.map((code) => {
    const candidateCodes = Array.from(
      new Set(
        (unmatchedCodePrefixes.get(code) ?? []).flatMap(
          (prefix) => prefixMatches.get(prefix) ?? [],
        ),
      ),
    );

    return [
      code,
      findClosestMatches(code, candidateCodes, { minimumScore: 0.55 }),
    ] as const;
  });

  return Object.fromEntries(
    suggestionEntries.filter(([, matches]) => matches.length > 0),
  );
}
