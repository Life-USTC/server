import type { CampusBuild, SectionBuild } from "./mappers";

export type CampusIdentityMap = {
  byJwId: Map<number, number>;
  byName: Map<string, number>;
};

export function normalizeCampusIdentity(
  campus: CampusBuild,
  nameByJwId: Map<number, string>,
): CampusBuild {
  if (campus.jwId == null) return campus;
  const existingName = nameByJwId.get(campus.jwId);
  if (existingName != null && existingName !== campus.nameCn) {
    return { ...campus, jwId: undefined };
  }
  nameByJwId.set(campus.jwId, campus.nameCn);
  return campus;
}

export function resolveSectionCampusDatabaseId(
  build: Pick<SectionBuild, "campusId" | "campusName">,
  campusMap: CampusIdentityMap,
) {
  return (
    (build.campusName != null
      ? campusMap.byName.get(build.campusName)
      : undefined) ??
    (build.campusId != null ? campusMap.byJwId.get(build.campusId) : undefined)
  );
}
