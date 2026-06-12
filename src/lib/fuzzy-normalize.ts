export function normalizeFuzzyValue(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function tokenizeFuzzyValue(value: string): string[] {
  return (
    value
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "")
      .match(/[A-Z]+\d*|\d+/g) ?? []
  );
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
