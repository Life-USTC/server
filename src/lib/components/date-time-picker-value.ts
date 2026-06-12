import { CalendarDate, type DateValue } from "@internationalized/date";

export function parseDateTimeLocal(input: string | null | undefined) {
  if (!input) return null;
  const match = input.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return null;
  return {
    date: new CalendarDate(
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
    ),
    time: `${match[4]}:${match[5]}`,
  };
}

export function dateTimeLocalValue(
  date: DateValue | undefined,
  time: string,
  defaultTime: string,
) {
  return date ? `${date.toString()}T${time || defaultTime}` : "";
}
