import { isRecord } from "@/lib/is-record";

export function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord);
}

export function pick<T extends Record<string, unknown>, K extends keyof T>(
  value: T,
  keys: readonly K[],
): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const key of keys) {
    if (Object.hasOwn(value, key) && value[key] !== undefined) {
      out[key] = value[key];
    }
  }
  return out;
}

export function compactRelations(
  source: Record<string, unknown>,
  relations: Record<string, (v: unknown) => unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, fn] of Object.entries(relations)) {
    if (Object.hasOwn(source, key)) {
      out[key] = fn(source[key]);
    }
  }
  return out;
}

export function compactArrayRelations(
  source: Record<string, unknown>,
  arrayRelations: Record<string, (v: unknown) => unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, fn] of Object.entries(arrayRelations)) {
    if (Object.hasOwn(source, key) && Array.isArray(source[key])) {
      out[key] = asRecordArray(source[key]).map(fn);
    }
  }
  return out;
}

export function transferScalarKeys(
  source: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (Object.hasOwn(source, key)) {
      out[key] = source[key];
    }
  }
  return out;
}

export function redactCalendarFeedLocation(value: string | null | undefined) {
  if (value == null) return null;
  if (value === "") return value;
  return value.replace(
    /(\/api\/calendar-feeds\/[^/:]+:)([^/?#]+)(\.ics)/,
    "$1[redacted]$3",
  );
}
