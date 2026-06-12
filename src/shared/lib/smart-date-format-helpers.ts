import type { Dayjs } from "dayjs";

export function formatZhMonthDay(due: Dayjs, includeYear: boolean): string {
  const monthDay = `${due.month() + 1}月${due.date()}日`;
  return includeYear ? `${due.year()}年${monthDay}` : monthDay;
}
