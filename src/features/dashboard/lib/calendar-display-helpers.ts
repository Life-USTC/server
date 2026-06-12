import { fmtTime } from "@/features/dashboard/lib/overview";

export function timeSortValue(value: Date | string | null | undefined) {
  if (!value) return 2400;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 2400;
  return date.getHours() * 100 + date.getMinutes();
}

export function calendarTimelineClass(tone: string) {
  if (tone === "error") return "border-error/30 bg-error/10";
  if (tone === "warning") return "border-warning/30 bg-warning/10";
  if (tone === "success") return "border-success/30 bg-success/10";
  return "border-info/30 bg-info/10";
}

export function compactDetail(
  value: string | null | undefined,
  maxLength = 80,
) {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 1)}…`
    : normalized;
}

export function calendarEventParts(
  parts: Array<string | number | null | undefined>,
) {
  return parts
    .map((part) => String(part ?? "").trim())
    .filter((part) => part.length > 0)
    .join(" · ");
}

export function calendarTimeRange(
  startTime: number | null | undefined,
  endTime: number | null | undefined,
) {
  const start = fmtTime(startTime);
  const end = fmtTime(endTime);
  if (start && end) return `${start}-${end}`;
  return start || end;
}
