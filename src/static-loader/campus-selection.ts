import type { CampusBuild } from "./mappers";

export function selectCampuses(
  occurrences: readonly CampusBuild[],
): CampusBuild[] {
  const byJwId = new Map<number, CampusBuild>();
  for (const campus of occurrences) {
    const existing = byJwId.get(campus.jwId);
    if (
      existing != null &&
      JSON.stringify(existing) !== JSON.stringify(campus)
    ) {
      throw new Error(`Campus jwId ${campus.jwId} has conflicting metadata`);
    }
    byJwId.set(campus.jwId, campus);
  }
  return [...byJwId.values()].sort((a, b) => a.jwId - b.jwId);
}
