import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { intlLocale, isZhLocale } from "@/shared/lib/time-locale";

/**
 * Short distance label for deadline surfaces: 今天 / 2周后 / 已逾期.
 */
export function formatDueRelativeTime(
  input: Date | string | number,
  referenceInput: Date | string | number,
  locale: string,
): string {
  const due = shanghaiDayjs(input);
  const ref = shanghaiDayjs(referenceInput);
  const isZh = isZhLocale(locale);
  if (!due.isValid() || !ref.isValid()) return "";

  if (due.diff(ref, "minute", true) <= 0) {
    return isZh ? "已逾期" : "Overdue";
  }

  const dayDiff = due.startOf("day").diff(ref.startOf("day"), "day");
  if (dayDiff === 0) {
    return isZh ? "今天" : "Today";
  }

  const absDayDiff = Math.abs(dayDiff);
  const formatter = new Intl.RelativeTimeFormat(intlLocale(locale), {
    numeric: "auto",
  });
  if (absDayDiff >= 60) {
    return formatter.format(Math.round(dayDiff / 30), "month");
  }
  if (absDayDiff >= 14) {
    return formatter.format(Math.round(dayDiff / 7), "week");
  }
  return formatter.format(dayDiff, "day");
}
