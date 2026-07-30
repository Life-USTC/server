import type { ConfigType, ManipulateType } from "dayjs";
import { APP_TIME_ZONE, parseDateInput } from "@/lib/time/parse-date-input";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";

export const APP_TIMESTAMP_FORMAT = "YYYY-MM-DDTHH:mm:ssZ";
export const APP_DATE_ONLY_FORMAT = "YYYY-MM-DD";
export const APP_TIME_ONLY_FORMAT = "HH:mm";
export const APP_DATETIME_LOCAL_FORMAT = "YYYY-MM-DDTHH:mm";

const MODERN_SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1_000;
const MODERN_SHANGHAI_START_MS = Date.UTC(1992, 0, 1);
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatModernShanghaiTimestamp(input: Date) {
  const time = input.getTime();
  if (!Number.isFinite(time) || time < MODERN_SHANGHAI_START_MS) return null;
  return `${new Date(time + MODERN_SHANGHAI_OFFSET_MS)
    .toISOString()
    .slice(0, 19)}+08:00`;
}

export function formatShanghaiTimestamp(input: ConfigType): string {
  if (input instanceof Date) {
    const fastTimestamp = formatModernShanghaiTimestamp(input);
    if (fastTimestamp) return fastTimestamp;
  }
  return shanghaiDayjs(input).format(APP_TIMESTAMP_FORMAT);
}

export function formatShanghaiDate(input: ConfigType): string {
  return shanghaiDayjs(input).format(APP_DATE_ONLY_FORMAT);
}

export function formatShanghaiTime(input: ConfigType): string {
  return shanghaiDayjs(input).format(APP_TIME_ONLY_FORMAT);
}

export function toShanghaiDateTimeLocalValue(
  value: string | Date | null | undefined,
): string {
  if (!value) return "";
  const parsed = value instanceof Date ? value : parseDateInput(value);
  if (!parsed) return "";
  return shanghaiDayjs(parsed).format(APP_DATETIME_LOCAL_FORMAT);
}

export function parseShanghaiDateTimeLocalInput(
  value: string,
): Date | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return parseDateInput(trimmed);
}

export function startOfShanghaiDay(input: ConfigType = new Date()): Date {
  return shanghaiDayjs(input).startOf("day").toDate();
}

export function endOfShanghaiDay(input: ConfigType = new Date()): Date {
  return shanghaiDayjs(input)
    .hour(23)
    .minute(59)
    .second(0)
    .millisecond(0)
    .toDate();
}

export function addShanghaiTime(
  input: ConfigType,
  amount: number,
  unit: ManipulateType,
): Date {
  return shanghaiDayjs(input).add(amount, unit).toDate();
}

export function createShanghaiDateTimeFormatter(
  locale: string | string[] = "en-US",
  options?: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const normalizedOptions = {
    timeZone: APP_TIME_ZONE,
    ...options,
  };
  const key = JSON.stringify([locale, normalizedOptions]);
  const cached = formatterCache.get(key);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat(locale, normalizedOptions);
  formatterCache.set(key, formatter);
  return formatter;
}
