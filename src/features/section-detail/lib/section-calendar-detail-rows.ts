import { calendarDetail as buildCalendarDetail } from "./calendar";

export function calendarDetail(
  label: string,
  value: string | number | null | undefined,
  notAvailable: string,
) {
  return buildCalendarDetail(label, value, notAvailable);
}
