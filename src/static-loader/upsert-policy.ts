export function requireCourseSourceKey(
  courseSourceKeyByParentId: ReadonlyMap<number, string>,
  lessonParentId: number,
): string {
  const sourceKey = courseSourceKeyByParentId.get(lessonParentId);
  if (sourceKey == null) {
    throw new Error(
      `Course identity key is missing for lesson parent ${lessonParentId}`,
    );
  }
  return sourceKey;
}

export function requireCourseDatabaseId(
  courseMap: ReadonlyMap<string, number>,
  courseSourceKey: string,
  sectionJwId: number,
): number {
  const courseId = courseMap.get(courseSourceKey);
  if (courseId == null) {
    throw new Error(
      `Course identity map did not resolve section jwId ${sectionJwId}`,
    );
  }
  return courseId;
}

export function sectionConflictUpdateColumns(
  columns: readonly string[],
): string[] {
  return columns.filter((column) => column !== "courseId");
}
