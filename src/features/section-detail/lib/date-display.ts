export function formatDate(
  value: string | Date | null | undefined,
  fallback: string,
) {
  if (!value) return fallback;
  return new Date(value).toLocaleDateString();
}

export function formatDateTime(
  value: string | Date | null | undefined,
  fallback: string,
) {
  if (!value) return fallback;
  return new Date(value).toLocaleString();
}

export function formatTime(value: number | null | undefined, fallback: string) {
  if (value == null) return fallback;
  const padded = String(value).padStart(4, "0");
  return `${padded.slice(0, 2)}:${padded.slice(2)}`;
}

export function timeSort(value: number | null | undefined) {
  return value ?? Number.MAX_SAFE_INTEGER;
}

export function dateKey(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function addMonths(value: Date, offset: number) {
  return new Date(value.getFullYear(), value.getMonth() + offset, 1);
}

export function calendarMonthDays(monthStart: Date) {
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

export function calendarWeeks(days: Date[]) {
  return Array.from({ length: Math.ceil(days.length / 7) }, (_, index) =>
    days.slice(index * 7, index * 7 + 7),
  );
}
