export function formatDateOnly(
  value: Date | string | null | undefined,
  fallback: string,
) {
  if (!value) return fallback;
  return String(value).slice(0, 10);
}

export function examDateTime(
  value: Date | string | null,
  hhmm: number | null,
  fallback: string,
) {
  if (!value) return null;
  const [year, month, day] = formatDateOnly(value, fallback)
    .split("-")
    .map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  if (hhmm == null) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(Math.floor(hhmm / 100), hhmm % 100, 0, 0);
  }
  return date;
}

export function examReferenceNow(value: string | null | undefined) {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function formatExamTime(value: number | null | undefined) {
  if (value == null) return "";
  const padded = String(value).padStart(4, "0");
  return `${padded.slice(0, 2)}:${padded.slice(2)}`;
}

export function examTimeLabel(
  startTime: number | null | undefined,
  endTime: number | null | undefined,
) {
  const start = formatExamTime(startTime);
  const end = formatExamTime(endTime);
  if (start && end) return `${start}-${end}`;
  return start || end;
}
