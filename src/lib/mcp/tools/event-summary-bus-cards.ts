import { pick } from "@/lib/mcp/compact-payload";
import { isRecord } from "@/lib/utils";

export function summarizeBusDeparture(value: unknown) {
  if (!isRecord(value)) return value;
  const out: Record<string, unknown> = pick(value, [
    "tripId",
    "routeId",
    "departureTime",
    "arrivalTime",
    "minutesUntilDeparture",
    "dayType",
    "status",
    "departureEstimated",
    "arrivalEstimated",
  ]);
  if (isRecord(value.route)) {
    out.route = pick(value.route, [
      "id",
      "nameCn",
      "nameEn",
      "descriptionPrimary",
      "descriptionSecondary",
    ]);
  }
  return out;
}
