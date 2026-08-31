import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import type { BusResolvedDayType } from "./bus-types";

export function resolveBusDayType(
  inputDayType: BusResolvedDayType | undefined,
  now = shanghaiDayjs(),
): "weekday" | "saturday" | "sunday" {
  if (
    inputDayType === "weekday" ||
    inputDayType === "saturday" ||
    inputDayType === "sunday"
  ) {
    return inputDayType;
  }
  const day = now.day();
  return day === 6 ? "saturday" : day === 0 ? "sunday" : "weekday";
}
