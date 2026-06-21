import { parseRequiredDateInput } from "@/lib/time/date-time-from-hhmm";
import { formatShanghaiDate } from "@/lib/time/shanghai-format";

export {
  parseRequiredDateInput,
  toDateTimeFromHHmm,
} from "@/lib/time/date-time-from-hhmm";

export function getTodayBounds(atTime?: Date) {
  const now = atTime ?? new Date();
  const todayStart = parseRequiredDateInput(formatShanghaiDate(now));
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  return { now, todayStart, tomorrowStart };
}
