import { parseDateInput } from "@/lib/time/parse-date-input";
import { formatShanghaiDate } from "@/lib/time/shanghai-format";

type ExamDateValue = Date | string | null | undefined;

function parseExamDate(value: ExamDateValue) {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }

  const parsed = parseDateInput(value);
  return parsed instanceof Date ? parsed : null;
}

function examDateKey(value: ExamDateValue) {
  const parsed = parseExamDate(value);
  return parsed ? formatShanghaiDate(parsed) : null;
}

export function formatDateOnly(value: ExamDateValue, fallback: string) {
  return examDateKey(value) ?? fallback;
}

export function examDateTime(value: ExamDateValue, hhmm: number | null) {
  const date = examDateKey(value);
  if (!date) return null;

  const time =
    hhmm == null
      ? "23:59:59.999"
      : `${String(Math.floor(hhmm / 100)).padStart(2, "0")}:${String(hhmm % 100).padStart(2, "0")}:00`;
  const parsed = parseDateInput(`${date}T${time}`);
  return parsed instanceof Date ? parsed : null;
}

export function examReferenceNow(value: ExamDateValue) {
  if (!value) return new Date();
  const parsed = parseExamDate(value);
  return parsed ?? new Date();
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
