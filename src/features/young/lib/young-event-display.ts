import { toShanghaiDateTimeLocalValue } from "@/lib/time/shanghai-format";

export function youngDateTime(value: string | null | undefined): string | null {
  if (!value) return null;
  return toShanghaiDateTimeLocalValue(value).replace("T", " ") || null;
}

export function youngDateRange(
  start: string | null,
  end: string | null,
  copy: { startsAt: string; endsAt: string },
): string | null {
  const from = youngDateTime(start);
  const to = youngDateTime(end);
  if (from && to) return `${from} – ${to}`;
  if (from) return copy.startsAt.replace("{value}", from);
  if (to) return copy.endsAt.replace("{value}", to);
  return null;
}

/** Unknown occupancy must never look like zero registrations. */
export function youngCapacity(
  applied: number | null,
  capacity: number | null,
  unknown: string,
): string {
  if (capacity != null) return `${applied ?? unknown} / ${capacity}`;
  return applied == null ? unknown : String(applied);
}
