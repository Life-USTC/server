/** Case-insensitive string contains filter for Prisma queries. */
export function ilike(value: string): {
  contains: string;
  mode: "insensitive";
} {
  return { contains: value, mode: "insensitive" };
}

/**
 * Free-text search splits on whitespace and ANDs one condition group per term,
 * so each extra term multiplies the work. A leading-wildcard `ILIKE` cannot use
 * the trigram indexes below three characters, so those groups are sequential
 * scans: the 200-character query limit alone admits roughly eighty of them.
 * Cap the terms instead. Dropping the tail only widens the result set, which is
 * the same direction as the character truncation the query parsers already do.
 */
export const SEARCH_TERM_LIMIT = 6;

export function searchTerms(value: string): string[] {
  return [...new Set(value.trim().split(/\s+/u).filter(Boolean))].slice(
    0,
    SEARCH_TERM_LIMIT,
  );
}

export type IntegerFilter = number | string | null | undefined;

export function parseIntegerFilter(value: IntegerFilter): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) ? parsed : null;
}

export function applyIntegerFilter<T extends Record<string, unknown>>(
  where: T,
  key: keyof T,
  value: IntegerFilter,
) {
  const parsed = parseIntegerFilter(value);
  if (parsed !== null) {
    where[key] = parsed as T[keyof T];
  }
}

export function buildJwIdFilter(value: IntegerFilter) {
  const parsed = parseIntegerFilter(value);
  return parsed === null ? null : { jwId: parsed };
}

export function buildRelatedFilter(
  idKey: string,
  idValue: IntegerFilter,
  codeValue?: string | null,
) {
  const parsedId = parseIntegerFilter(idValue);
  const code = codeValue?.trim();
  if (parsedId === null && !code) return null;
  return {
    ...(parsedId === null ? {} : { [idKey]: parsedId }),
    ...(code ? { code } : {}),
  };
}

export function parseIdsFilter(value: number[] | string | null | undefined) {
  if (Array.isArray(value)) {
    return value.filter((item) => Number.isInteger(item));
  }
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((item) => parseIntegerFilter(item))
    .filter((item): item is number => item !== null);
}
