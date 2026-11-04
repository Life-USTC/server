import { CalendarDate, type DateValue } from "@internationalized/date";

export function parseDateTimeLocal(input: string | null | undefined) {
  if (!input) return null;
  const match = input.match(
    /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)$/,
  );
  if (!match) return null;
  const date = new CalendarDate(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  );
  if (date.toString() !== `${match[1]}-${match[2]}-${match[3]}`) return null;
  return {
    date,
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
