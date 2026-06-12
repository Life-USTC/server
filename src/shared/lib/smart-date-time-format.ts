import { APP_TIME_ZONE } from "@/lib/time/parse-date-input";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { isSameDefaultWeek } from "@/shared/lib/date-utils";
import { formatZhMonthDay } from "@/shared/lib/smart-date-format-helpers";
import { intlLocale, isZhLocale } from "@/shared/lib/time-locale";

/**
 * Human-friendly deadline: 今天/明天/昨天、同周星期、同年省略年份等。
 */
export function formatSmartDateTime(
  input: Date | string | number,
  referenceInput: Date | string | number,
  locale: string,
): string {
  const due = shanghaiDayjs(input);
  const ref = shanghaiDayjs(referenceInput);
  const isZh = isZhLocale(locale);
  const time = due.format("HH:mm");
  const il = intlLocale(locale);

  if (due.isSame(ref, "day")) {
    return isZh ? `今天 ${time}` : `Today, ${time}`;
  }
  if (due.isSame(ref.add(1, "day"), "day")) {
    return isZh ? `明天 ${time}` : `Tomorrow, ${time}`;
  }
  if (due.isSame(ref.subtract(1, "day"), "day")) {
    return isZh ? `昨天 ${time}` : `Yesterday, ${time}`;
  }

  if (isSameDefaultWeek(due, ref)) {
    const wk = new Intl.DateTimeFormat(il, {
      timeZone: APP_TIME_ZONE,
      weekday: "short",
    }).format(due.toDate());
    return isZh ? `${wk} ${time}` : `${wk}, ${time}`;
  }

  const sameYear = due.year() === ref.year();
  if (isZh) {
    return `${formatZhMonthDay(due, !sameYear)} ${time}`;
  }

  const d = due.toDate();
  if (sameYear) {
    return new Intl.DateTimeFormat(il, {
      timeZone: APP_TIME_ZONE,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  }
  return new Intl.DateTimeFormat(il, {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}
