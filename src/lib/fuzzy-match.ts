export {
  extractCodePrefixes,
  normalizeFuzzyValue,
} from "@/lib/fuzzy-normalize";

import { normalizeFuzzyValue } from "@/lib/fuzzy-normalize";
import { computeFuzzyScore } from "@/lib/fuzzy-score";

export function findClosestMatches(
  query: string,
  candidates: readonly string[],
  options?: {
    limit?: number;
    minimumScore?: number;
  },
) {
  const normalizedQuery = normalizeFuzzyValue(query);
  if (!normalizedQuery) return [];

  const limit = options?.limit ?? 3;
  const minimumScore = options?.minimumScore ?? 0.45;

  return Array.from(new Set(candidates))
    .filter((candidate) => normalizeFuzzyValue(candidate) !== normalizedQuery)
    .map((candidate) => ({
      candidate,
      score: computeFuzzyScore(query, candidate),
    }))
    .filter(({ score }) => score >= minimumScore)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }
      return left.candidate.localeCompare(right.candidate);
    })
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}
