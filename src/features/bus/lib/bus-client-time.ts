import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";

export function resolveClientBusDayType(
  now = new Date(),
): "weekday" | "weekend" {
  const day = now.getDay();
  return day === 0 || day === 6 ? "weekend" : "weekday";
}

export function getShanghaiMinutesSinceMidnight(now: Date | string): number {
  const shanghaiNow = shanghaiDayjs(now);
  return shanghaiNow.hour() * 60 + shanghaiNow.minute();
}
