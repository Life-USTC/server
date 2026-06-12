import { APP_TIME_ZONE } from "@/lib/time/parse-date-input";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { isSameDefaultWeek } from "@/shared/lib/date-utils";
import { formatZhMonthDay } from "@/shared/lib/smart-date-format-helpers";
import { intlLocale, isZhLocale } from "@/shared/lib/time-locale";

/**
 * Date-only smart label (e.g. todo due date): no time fragment.
 */
export function formatSmartDate(
  input: Date | string | number,
  referenceInput: Date | string | number,
  locale: string,
): string {
  const due = shanghaiDayjs(input).startOf("day");
  const ref = shanghaiDayjs(referenceInput).startOf("day");
  const isZh = isZhLocale(locale);
  const il = intlLocale(locale);

  if (due.isSame(ref, "day")) {
    return isZh ? "今天" : "Today";
  }
  if (due.isSame(ref.add(1, "day"), "day")) {
    return isZh ? "明天" : "Tomorrow";
  }
  if (due.isSame(ref.subtract(1, "day"), "day")) {
    return isZh ? "昨天" : "Yesterday";
  }

  if (isSameDefaultWeek(due, ref)) {
    return new Intl.DateTimeFormat(il, {
      timeZone: APP_TIME_ZONE,
      weekday: "long",
    }).format(due.toDate());
  }

  const sameYear = due.year() === ref.year();
  if (isZh) {
    return formatZhMonthDay(due, !sameYear);
  }

  const d = due.toDate();
  if (sameYear) {
    return new Intl.DateTimeFormat(il, {
      timeZone: APP_TIME_ZONE,
      month: "short",
      day: "numeric",
    }).format(d);
  }
  return new Intl.DateTimeFormat(il, {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}
