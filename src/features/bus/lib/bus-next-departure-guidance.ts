import type { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { resolveBusDayType } from "./bus-day-type";
import type {
  BusNextDeparturesResult,
  BusResolvedDayType,
  BusTimetableData,
} from "./bus-types";

export function buildNoBusDepartureMessage({
  applicableRouteCount,
  dayType,
  departureCount,
  nextAvailableDeparture,
}: {
  applicableRouteCount: number;
  dayType: BusResolvedDayType;
  departureCount: number;
  nextAvailableDeparture: BusNextDeparturesResult["nextAvailableDeparture"];
}) {
  return departureCount > 0
    ? null
    : applicableRouteCount === 0
      ? "No shuttle route is available for the requested origin and destination campuses."
      : nextAvailableDeparture
        ? `No more ${dayType} departures are available right now. The next available service is at ${nextAvailableDeparture.departureTime ?? "an estimated time"}.`
        : `No more ${dayType} departures are available in the next 7 days for the requested route.`;
}

export function findNextAvailableBusDeparture({
  buildSnapshot,
  data,
  destinationCampusId,
  now,
  originCampusId,
}: {
  buildSnapshot: (
    data: BusTimetableData,
    input: {
      originCampusId: number;
      destinationCampusId: number;
      atTime?: string;
      dayType?: BusResolvedDayType;
      limit?: number;
      includeDeparted?: boolean;
      includeNextAvailableGuidance?: boolean;
    },
  ) => BusNextDeparturesResult;
  data: BusTimetableData;
  destinationCampusId: number;
  now: ReturnType<typeof shanghaiDayjs>;
  originCampusId: number;
}) {
  for (let dayOffset = 1; dayOffset < 7; dayOffset += 1) {
    const probeTime = now
      .add(dayOffset, "day")
      .hour(0)
      .minute(0)
      .second(0)
      .millisecond(0);
    const probeDayType = resolveBusDayType(undefined, probeTime);
    const probeResult = buildSnapshot(data, {
      originCampusId,
      destinationCampusId,
      atTime: probeTime.toISOString(),
      dayType: probeDayType,
      limit: 1,
      includeDeparted: false,
      includeNextAvailableGuidance: false,
    });
    if (probeResult.departures.length > 0) {
      return probeResult.departures[0] ?? null;
    }
  }

  return null;
}
