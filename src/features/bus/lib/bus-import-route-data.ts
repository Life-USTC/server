import type { BusStaticCampus } from "./bus-types";

export function normalizeBusCampusName(name: string) {
  return name.trim();
}

/** Fix historical static payloads that stored lon/lat swapped. */
export function normalizeBusCampusCoordinates(input: {
  latitude: number;
  longitude: number;
}) {
  const { latitude, longitude } = input;
  if (Math.abs(latitude) > 90 && Math.abs(longitude) <= 90) {
    return { latitude: longitude, longitude: latitude };
  }
  return { latitude, longitude };
}

export function buildBusRouteNameData(campuses: BusStaticCampus[]) {
  return {
    nameCn: campuses.map((campus) => campus.name).join(" -> "),
    nameEn: buildRouteEnglishName(campuses),
  };
}

function buildRouteEnglishName(campuses: BusStaticCampus[]) {
  const start = campuses[0]?.name ?? "";
  const end = campuses[campuses.length - 1]?.name ?? "";
  return start && end ? `${start} to ${end}` : null;
}
