import type { CourseBuild } from "./mappers";

export type CourseOccurrence = {
  semesterCode: number;
  course: CourseBuild;
};

export function selectLatestCourses(
  occurrences: readonly CourseOccurrence[],
): CourseBuild[] {
  const byJwId = new Map<number, CourseOccurrence>();
  for (const occurrence of occurrences) {
    const existing = byJwId.get(occurrence.course.jwId);
    if (existing != null && existing.course.code !== occurrence.course.code) {
      throw new Error(
        `Course jwId ${occurrence.course.jwId} maps to conflicting codes: ${existing.course.code} vs ${occurrence.course.code}`,
      );
    }
    if (
      existing == null ||
      occurrence.semesterCode > existing.semesterCode ||
      (occurrence.semesterCode === existing.semesterCode &&
        stableMetadataKey(occurrence.course) >
          stableMetadataKey(existing.course))
    ) {
      byJwId.set(occurrence.course.jwId, occurrence);
    }
  }
  return [...byJwId.values()]
    .sort((a, b) => a.course.jwId - b.course.jwId)
    .map(({ course }) => course);
}

function stableMetadataKey(course: CourseBuild): string {
  return JSON.stringify([
    course.nameCn,
    course.nameEn ?? null,
    course.categoryName ?? null,
    course.classTypeName ?? null,
    course.classifyName ?? null,
    course.educationLevelName ?? null,
    course.gradationName ?? null,
    course.typeName ?? null,
  ]);
}
