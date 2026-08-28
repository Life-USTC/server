import type { CampusBuild } from "./mappers";

export type CampusOccurrence = {
  semesterCode: number;
  source: "building" | "catalog";
  campus: CampusBuild;
};

export function selectCampuses(
  occurrences: readonly CampusOccurrence[],
): CampusBuild[] {
  const byJwId = new Map<number, CampusOccurrence[]>();
  for (const occurrence of occurrences) {
    const group = byJwId.get(occurrence.campus.jwId) ?? [];
    const conflicting = group.find(
      (existing) =>
        existing.semesterCode === occurrence.semesterCode &&
        existing.source === occurrence.source &&
        JSON.stringify(existing.campus) !== JSON.stringify(occurrence.campus),
    );
    if (conflicting != null) {
      throw new Error(
        `Campus jwId ${occurrence.campus.jwId} has conflicting ${occurrence.source} metadata in semester ${occurrence.semesterCode}`,
      );
    }
    group.push(occurrence);
    byJwId.set(occurrence.campus.jwId, group);
  }
  return [...byJwId]
    .sort(([left], [right]) => left - right)
    .map(([jwId, group]) => {
      const sorted = [...group].sort(
        (left, right) =>
          right.semesterCode - left.semesterCode ||
          sourcePriority(right.source) - sourcePriority(left.source) ||
          JSON.stringify(right.campus).localeCompare(
            JSON.stringify(left.campus),
          ),
      );
      return {
        jwId,
        nameCn: sorted[0].campus.nameCn,
        nameEn: sorted.find(({ campus }) => campus.nameEn)?.campus.nameEn,
        code: sorted.find(({ campus }) => campus.code)?.campus.code,
      };
    });
}

function sourcePriority(source: CampusOccurrence["source"]): number {
  return source === "catalog" ? 1 : 0;
}
