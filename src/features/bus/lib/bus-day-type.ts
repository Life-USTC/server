import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import type { BusResolvedDayType } from "./bus-types";

export function resolveBusDayType(
  inputDayType: BusResolvedDayType | undefined,
  now = shanghaiDayjs(),
): "weekday" | "weekend" {
  if (inputDayType === "weekday" || inputDayType === "weekend") {
    return inputDayType;
  }
  const day = now.day();
  return day === 0 || day === 6 ? "weekend" : "weekday";
}
