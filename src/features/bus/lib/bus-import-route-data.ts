import type { BusStaticCampus } from "./bus-types";

export function normalizeBusCampusName(name: string) {
  return name.trim();
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
