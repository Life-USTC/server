import { resolveCampusDate, toCampusDateKey } from "@/lib/time/campus-date";
import { parseDateInput } from "@/lib/time/parse-date-input";
import { formatTime } from "@/shared/lib/clock-time-format";

type ExamDateValue = Date | string | null | undefined;

export function formatDateOnly(value: ExamDateValue, fallback: string) {
  return toCampusDateKey(value) ?? fallback;
}

export function examDateTime(value: ExamDateValue, hhmm: number | null) {
  const date = toCampusDateKey(value);
  if (!date) return null;

  const time =
    hhmm == null
      ? "23:59:59.999"
      : `${String(Math.floor(hhmm / 100)).padStart(2, "0")}:${String(hhmm % 100).padStart(2, "0")}:00`;
  const parsed = parseDateInput(`${date}T${time}`);
  return parsed instanceof Date ? parsed : null;
}

export function examReferenceNow(value: ExamDateValue) {
  return resolveCampusDate(value) ?? new Date();
}

export function examTimeLabel(
  startTime: number | null | undefined,
  endTime: number | null | undefined,
) {
  const start = formatTime(startTime, "");
  const end = formatTime(endTime, "");
  if (start && end) return `${start}-${end}`;
  return start || end;
}
