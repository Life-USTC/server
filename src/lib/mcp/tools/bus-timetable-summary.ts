import {
  buildNextBusDeparturesFromData,
  type getBusTimetableData,
} from "@/features/bus/lib/bus-service";

type BusTimetableResult = NonNullable<
  Awaited<ReturnType<typeof getBusTimetableData>>
>;

export function summarizeBusTimetable(result: BusTimetableResult) {
  const weekdayTrips = result.trips.filter(
    (trip) => trip.dayType === "weekday",
  );
  const weekendTrips = result.trips.filter(
    (trip) => trip.dayType === "weekend",
  );
  const nextDepartures =
    result.preferences?.preferredOriginCampusId != null &&
    result.preferences?.preferredDestinationCampusId != null
      ? buildNextBusDeparturesFromData(result, {
          originCampusId: result.preferences.preferredOriginCampusId,
          destinationCampusId: result.preferences.preferredDestinationCampusId,
          atTime: result.fetchedAt,
          includeDeparted: result.preferences.showDepartedTrips,
          limit: 3,
        }).departures
      : [];
  const nextDeparturesMessage =
    result.preferences?.preferredOriginCampusId == null ||
    result.preferences?.preferredDestinationCampusId == null
      ? "Save preferred origin and destination campuses or call get_next_buses for a specific route query."
      : nextDepartures.length === 0
        ? "No immediate departures are available for the saved campus preference."
        : null;

  return {
    locale: result.locale,
    fetchedAt: result.fetchedAt,
    version: result.version
      ? {
          key: result.version.key,
          title: result.version.title,
          effectiveFrom: result.version.effectiveFrom,
          effectiveUntil: result.version.effectiveUntil,
        }
      : null,
    counts: {
      campuses: result.campuses.length,
      routes: result.routes.length,
      weekdayTrips: weekdayTrips.length,
      weekendTrips: weekendTrips.length,
    },
    campuses: result.campuses.map((campus) => ({
      id: campus.id,
      namePrimary: campus.namePrimary,
      nameSecondary: campus.nameSecondary,
    })),
    routes: result.routes.slice(0, 10).map((route) => ({
      id: route.id,
      nameCn: route.nameCn,
      nameEn: route.nameEn,
      descriptionPrimary: route.descriptionPrimary,
      descriptionSecondary: route.descriptionSecondary,
    })),
    preferences: result.preferences,
    nextDepartures,
    nextDeparturesMessage,
    notice: result.notice?.message ? { message: result.notice.message } : null,
  };
}

export function summarizeBusTimetableBrief(result: BusTimetableResult) {
  const compact = summarizeBusTimetable(result);
  return {
    locale: compact.locale,
    fetchedAt: compact.fetchedAt,
    version: compact.version,
    counts: compact.counts,
    preferences: compact.preferences,
    nextDepartures: compact.nextDepartures,
    nextDeparturesMessage: compact.nextDeparturesMessage,
    notice: compact.notice,
  };
}
