import { normalizeFuzzyValue, tokenizeFuzzyValue } from "@/lib/fuzzy-normalize";

function levenshteinDistance(left: string, right: string) {
  if (left === right) return 0;
  if (left.length === 0) return right.length;
  if (right.length === 0) return left.length;

  const previous = Array.from(
    { length: right.length + 1 },
    (_, index) => index,
  );
  const current = new Array<number>(right.length + 1).fill(0);

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    current[0] = leftIndex + 1;

    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex] === right[rightIndex] ? 0 : 1;
      current[rightIndex + 1] = Math.min(
        current[rightIndex] + 1,
        previous[rightIndex + 1] + 1,
        previous[rightIndex] + substitutionCost,
      );
    }

    for (let column = 0; column < current.length; column += 1) {
      previous[column] = current[column];
    }
  }

  return previous[right.length] ?? 0;
}

export function computeFuzzyScore(query: string, candidate: string) {
  const normalizedQuery = normalizeFuzzyValue(query);
  const normalizedCandidate = normalizeFuzzyValue(candidate);
  if (!normalizedQuery || !normalizedCandidate) return Number.NEGATIVE_INFINITY;
  if (normalizedQuery === normalizedCandidate) return Number.POSITIVE_INFINITY;

  const distance = levenshteinDistance(normalizedQuery, normalizedCandidate);
  const maxLength = Math.max(
    normalizedQuery.length,
    normalizedCandidate.length,
  );
  const similarity = 1 - distance / maxLength;
  const prefixBonus = normalizedCandidate.startsWith(normalizedQuery) ? 0.2 : 0;
  const containsBonus = normalizedCandidate.includes(normalizedQuery) ? 0.1 : 0;
  const queryTokens = tokenizeFuzzyValue(query);
  const candidateTokens = tokenizeFuzzyValue(candidate);
  const significantQueryTokens = queryTokens.filter(
    (token) => token.length >= 4,
  );
  const significantOverlap = significantQueryTokens.filter((token) =>
    candidateTokens.includes(token),
  ).length;
  if (significantQueryTokens.length > 0 && significantOverlap === 0) {
    return Number.NEGATIVE_INFINITY;
  }
  const tokenOverlapBonus =
    significantOverlap > 0 ? Math.min(0.3, significantOverlap * 0.15) : 0;

  return similarity + prefixBonus + containsBonus + tokenOverlapBonus;
}
