import type { Dayjs } from "dayjs";
import { APP_TIME_ZONE } from "@/lib/time/parse-date-input";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";

export type WeekStartsOn = 0 | 1;

export const MONDAY_WEEK_STARTS_ON: WeekStartsOn = 1;
export const SUNDAY_WEEK_STARTS_ON: WeekStartsOn = 0;
export const DEFAULT_WEEK_STARTS_ON: WeekStartsOn = SUNDAY_WEEK_STARTS_ON;

export const getWeekStart = (
  date: Dayjs,
  weekStartsOn: WeekStartsOn = DEFAULT_WEEK_STARTS_ON,
) => {
  const normalizedDate = date.startOf("day");
  const diff = (normalizedDate.day() - weekStartsOn + 7) % 7;
  return normalizedDate.subtract(diff, "day");
};

export const getWeekRange = (
  date: Dayjs,
  weekStartsOn: WeekStartsOn = DEFAULT_WEEK_STARTS_ON,
) => {
  const start = getWeekStart(date, weekStartsOn);
  return {
    start,
    endExclusive: start.add(7, "day"),
  };
};

export const isSameWeek = (
  left: Dayjs,
  right: Dayjs,
  weekStartsOn: WeekStartsOn = DEFAULT_WEEK_STARTS_ON,
) => {
  return getWeekStart(left, weekStartsOn).isSame(
    getWeekStart(right, weekStartsOn),
    "day",
  );
};

export const getDefaultWeekStart = (date: Dayjs) =>
  getWeekStart(date, DEFAULT_WEEK_STARTS_ON);

export const getDefaultWeekRange = (date: Dayjs) =>
  getWeekRange(date, DEFAULT_WEEK_STARTS_ON);

export const isSameDefaultWeek = (left: Dayjs, right: Dayjs) =>
  isSameWeek(left, right, DEFAULT_WEEK_STARTS_ON);

export const formatDateTime = (date: Date, time: number, locale: string) => {
  const datetime = shanghaiDayjs(date)
    .hour(Math.floor(time / 100))
    .minute(time % 100)
    .toDate();
  return new Intl.DateTimeFormat(locale, {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(datetime);
};

export const createWeekDayFormatter = (locale: string) =>
  new Intl.DateTimeFormat(locale, {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
    month: "2-digit",
    day: "2-digit",
  });
