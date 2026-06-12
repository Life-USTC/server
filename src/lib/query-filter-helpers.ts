/** Case-insensitive string contains filter for Prisma queries. */
export function ilike(value: string): {
  contains: string;
  mode: "insensitive";
} {
  return { contains: value, mode: "insensitive" };
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
