export function parseInteger(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!normalized || !/^-?\d+$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function parseIntegerList(value: unknown, separator = ","): number[] {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(separator)
    .map((entry) => parseInteger(entry))
    .filter((entry): entry is number => entry !== null);
}
