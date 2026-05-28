export function normalizeFuzzyValue(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Extract significant lookup prefixes from a section code for fuzzy matching.
 * Tokenizes the code, selects significant chunks, and truncates each to a
 * bounded-length prefix suitable for database LIKE queries.
 */
export function extractCodePrefixes(code: string): string[] {
  const chunks = normalizeFuzzyValue(code).match(/[A-Z0-9]+/g) ?? [];
  const significantChunks = chunks.filter(
    (chunk) => chunk.length >= 4 || (chunk.length >= 3 && /\d/.test(chunk)),
  );
  const lookupChunks =
    significantChunks.length > 0 ? significantChunks : chunks;
  return Array.from(
    new Set(
      lookupChunks
        .map((chunk) => chunk.slice(0, Math.min(6, Math.max(3, chunk.length))))
        .filter((chunk) => chunk.length >= 3),
    ),
  ).slice(0, 6);
}

function tokenizeFuzzyValue(value: string): string[] {
  return (
    value
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "")
      .match(/[A-Z]+\d*|\d+/g) ?? []
  );
}

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

function computeFuzzyScore(query: string, candidate: string) {
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
