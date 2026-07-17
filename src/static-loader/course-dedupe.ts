import type { CourseIdentityRecord } from "./course-identity";

export type PersistedCourseIdentityRecord = CourseIdentityRecord & {
  id: number;
};

export type CourseDuplicateMerge = {
  sourceCourseId: number;
  sourceJwId: number;
  targetCourseId: number;
  targetJwId: number;
};

function normalizedRequired(value: string) {
  return value.trim();
}

function normalizedOptional(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function hasSameClassification(
  left: CourseIdentityRecord,
  right: CourseIdentityRecord,
) {
  return (
    left.categoryId === right.categoryId &&
    left.classTypeId === right.classTypeId &&
    left.classifyId === right.classifyId &&
    left.educationLevelId === right.educationLevelId &&
    left.gradationId === right.gradationId &&
    left.typeId === right.typeId
  );
}

function isSafeLegacyDuplicate(
  candidate: CourseIdentityRecord,
  canonical: CourseIdentityRecord,
) {
  if (
    normalizedRequired(candidate.code) !== normalizedRequired(canonical.code) ||
    normalizedRequired(candidate.nameCn) !==
      normalizedRequired(canonical.nameCn) ||
    !hasSameClassification(candidate, canonical)
  ) {
    return false;
  }

  const candidateNameEn = normalizedOptional(candidate.nameEn);
  const canonicalNameEn = normalizedOptional(canonical.nameEn);
  return (
    candidateNameEn === canonicalNameEn ||
    (candidateNameEn === null && canonicalNameEn !== null)
  );
}

/**
 * Merge only stale rows that are absent from the current snapshot and have one
 * unambiguous current canonical match. Missing English text may be enriched by
 * the current row, but the cleanup never discards richer legacy metadata.
 */
export function planCourseDuplicateMerges({
  canonicalJwIds,
  incomingSourceJwIds,
  persistedCourses,
}: {
  canonicalJwIds: ReadonlySet<number>;
  incomingSourceJwIds: ReadonlySet<number>;
  persistedCourses: PersistedCourseIdentityRecord[];
}): CourseDuplicateMerge[] {
  const canonicalCourses = persistedCourses.filter((course) =>
    canonicalJwIds.has(course.jwId),
  );
  if (canonicalCourses.length !== canonicalJwIds.size) {
    throw new Error("Course cleanup could not resolve every canonical Course");
  }

  const merges: CourseDuplicateMerge[] = [];
  for (const candidate of persistedCourses) {
    if (
      canonicalJwIds.has(candidate.jwId) ||
      incomingSourceJwIds.has(candidate.jwId)
    ) {
      continue;
    }

    const matches = canonicalCourses.filter((canonical) =>
      isSafeLegacyDuplicate(candidate, canonical),
    );
    if (matches.length > 1) {
      throw new Error(
        `Ambiguous legacy Course ${candidate.jwId}: ${matches.length} canonical matches`,
      );
    }
    if (matches.length === 0) continue;

    merges.push({
      sourceCourseId: candidate.id,
      sourceJwId: candidate.jwId,
      targetCourseId: matches[0].id,
      targetJwId: matches[0].jwId,
    });
  }

  return merges.sort((left, right) => left.sourceJwId - right.sourceJwId);
}
