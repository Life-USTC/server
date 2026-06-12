import type { ConfigType } from "dayjs";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import { APP_TIME_ZONE, parseDateInput } from "@/lib/time/parse-date-input";

dayjs.extend(utc);
dayjs.extend(timezone);

export { dayjs };

export function shanghaiDayjs(input?: ConfigType) {
  if (input === undefined) return dayjs().tz(APP_TIME_ZONE);
  if (typeof input === "string") {
    const parsed = parseDateInput(input);
    return (parsed ? dayjs(parsed) : dayjs(input)).tz(APP_TIME_ZONE);
  }
  return dayjs(input).tz(APP_TIME_ZONE);
}
