import { SUSPENSION_DURATION_OPTIONS } from "@/features/admin/constants";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";
import {
  addShanghaiTime,
  parseShanghaiDateTimeLocalInput,
} from "@/lib/time/shanghai-format";

export function suspensionExpiresAt(duration: string, customExpiresAt: string) {
  if (
    !SUSPENSION_DURATION_OPTIONS.some((option) => option.value === duration)
  ) {
    throw new RangeError("Unsupported suspension duration");
  }
  if (duration === "permanent") return undefined;
  if (duration === "custom") {
    const parsed = parseShanghaiDateTimeLocalInput(customExpiresAt);
    if (parsed) return toShanghaiIsoString(parsed);
    // Preserve the API contract: blank means permanent; invalid nonblank is rejected.
    return parsed === null ? undefined : customExpiresAt.trim();
  }
  const days = Number(duration.slice(0, -1));
  return toShanghaiIsoString(addShanghaiTime(new Date(), days, "day"));
}
