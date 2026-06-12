import type { getNextBusDepartures } from "@/features/bus/lib/bus-service";
import { summarizeBusDeparture } from "@/lib/mcp/tools/event-summary";

type NextBusDeparturesResult = NonNullable<
  Awaited<ReturnType<typeof getNextBusDepartures>>
>;

function omitRepeatedCampusesFromDepartures<
  T extends {
    originCampus?: unknown;
    destinationCampus?: unknown;
  },
>(departures: T[]) {
  return departures.map(
    ({
      originCampus: _originCampus,
      destinationCampus: _destinationCampus,
      ...departure
    }) => departure,
  );
}

export function summarizeNextBusDepartures(result: NextBusDeparturesResult) {
  return {
    ...result,
    departures: omitRepeatedCampusesFromDepartures(result.departures),
    nextAvailableDeparture: result.nextAvailableDeparture
      ? summarizeBusDeparture(result.nextAvailableDeparture)
      : null,
  };
}
