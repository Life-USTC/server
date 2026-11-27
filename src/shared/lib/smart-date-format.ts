import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { createShanghaiDateTimeFormatter } from "@/lib/time/shanghai-format";
import { isSameDefaultWeek } from "./date-utils";
import { intlLocale, isZhLocale } from "./time-locale";

type DateInput = Date | string | number;

function smartDateLabel(
  input: DateInput,
  reference: DateInput,
  locale: string,
  withTime: boolean,
) {
  const due = shanghaiDayjs(input);
  const ref = shanghaiDayjs(reference);
  const zh = isZhLocale(locale);
  const format = (options: Intl.DateTimeFormatOptions) =>
    createShanghaiDateTimeFormatter(intlLocale(locale), options).format(
      due.toDate(),
    );
  const time = withTime ? due.format("HH:mm") : "";
  const withClock = (label: string) =>
    time ? label + (zh ? " " : ", ") + time : label;

  if (due.isSame(ref, "day")) return withClock(zh ? "今天" : "Today");
  if (due.isSame(ref.add(1, "day"), "day"))
    return withClock(zh ? "明天" : "Tomorrow");
  if (due.isSame(ref.subtract(1, "day"), "day"))
    return withClock(zh ? "昨天" : "Yesterday");
  if (isSameDefaultWeek(due, ref))
    return withClock(format({ weekday: withTime ? "short" : "long" }));

  const showYear = due.year() !== ref.year();
  if (zh) {
    const year = showYear ? `${due.year()}年` : "";
    return withClock(`${year}${due.month() + 1}月${due.date()}日`);
  }
  return format({
    year: showYear ? "numeric" : undefined,
    month: "short",
    day: "numeric",
    ...(withTime && { hour: "numeric", minute: "2-digit" }),
  });
}

export function formatSmartDate(
  input: DateInput,
  reference: DateInput,
  locale: string,
) {
  return smartDateLabel(input, reference, locale, false);
}

export function formatSmartDateTime(
  input: DateInput,
  reference: DateInput,
  locale: string,
) {
  return smartDateLabel(input, reference, locale, true);
}
