import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";

export function resolveClientBusDayType(
  now = new Date(),
): "weekday" | "saturday" | "sunday" {
  const day = shanghaiDayjs(now).day();
  return day === 6 ? "saturday" : day === 0 ? "sunday" : "weekday";
}

export function getShanghaiMinutesSinceMidnight(now: Date | string): number {
  const shanghaiNow = shanghaiDayjs(now);
  return shanghaiNow.hour() * 60 + shanghaiNow.minute();
}
