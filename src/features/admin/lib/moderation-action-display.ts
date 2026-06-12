import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";
import {
  addShanghaiTime,
  parseShanghaiDateTimeLocalInput,
} from "@/lib/time/shanghai-format";

export function formAlertVariant(kind: unknown) {
  return kind === "error" ? "destructive" : "info";
}

export function responseMessage(response: Response, fallback: string) {
  return response
    .json()
    .then((body) => String(body?.message ?? body?.error?.message ?? fallback))
    .catch(() => fallback);
}

export function expiresAtFromModerationDuration(
  duration: string,
  customExpiresAt: string,
) {
  if (duration === "custom") {
    const parsed = parseShanghaiDateTimeLocalInput(customExpiresAt);
    return parsed ? toShanghaiIsoString(parsed) : undefined;
  }
  if (duration === "permanent") return undefined;
  const days = Number(duration.replace("d", ""));
  if (!Number.isFinite(days)) return undefined;
  return toShanghaiIsoString(addShanghaiTime(new Date(), days, "day"));
}
