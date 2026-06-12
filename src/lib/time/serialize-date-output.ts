import { formatShanghaiTimestamp } from "@/lib/time/shanghai-format";
import { isRecord } from "@/lib/utils";

export function toShanghaiIsoString(
  date: Date | string | null | undefined,
): string {
  if (!date) return "";
  return formatShanghaiTimestamp(date);
}

export function serializeDatesDeep<T>(value: T): T {
  if (value instanceof Date) {
    return toShanghaiIsoString(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeDatesDeep(item)) as T;
  }
  if (!isRecord(value)) return value;

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = serializeDatesDeep(item);
  }
  return out as T;
}
