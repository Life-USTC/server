import {
  compactCampus,
  compactCourse,
  compactExam,
  compactHomework,
  compactSchedule,
  compactSection,
  compactSemester,
  compactTeacher,
  compactTodo,
} from "./compact-entities";

type CompactArrayMatch = { matched: true; value: unknown } | { matched: false };

export function compactEntityArrayItem(
  value: Record<string, unknown>,
): CompactArrayMatch {
  if (
    Object.hasOwn(value, "latitude") &&
    Object.hasOwn(value, "longitude") &&
    !Object.hasOwn(value, "stops")
  ) {
    return {
      matched: true,
      value: compactCampus(value, { includeCoordinates: true }),
    };
  }

  if (
    Object.hasOwn(value, "teacherId") ||
    Object.hasOwn(value, "personId") ||
    Object.hasOwn(value, "teacherTitleId") ||
    Object.hasOwn(value, "departmentId")
  ) {
    return { matched: true, value: compactTeacher(value) };
  }

  if (Object.hasOwn(value, "completed") && Object.hasOwn(value, "priority")) {
    return { matched: true, value: compactTodo(value) };
  }

  if (
    Object.hasOwn(value, "submissionDueAt") &&
    (Object.hasOwn(value, "sectionId") ||
      Object.hasOwn(value, "isMajor") ||
      Object.hasOwn(value, "requiresTeam"))
  ) {
    return { matched: true, value: compactHomework(value) };
  }

  if (
    (Object.hasOwn(value, "examDate") ||
      Object.hasOwn(value, "examBatch") ||
      Object.hasOwn(value, "examRooms")) &&
    Object.hasOwn(value, "sectionId")
  ) {
    return { matched: true, value: compactExam(value) };
  }

  if (
    Object.hasOwn(value, "date") &&
    Object.hasOwn(value, "weekday") &&
    Object.hasOwn(value, "startTime") &&
    Object.hasOwn(value, "endTime")
  ) {
    return { matched: true, value: compactSchedule(value) };
  }

  if (
    Object.hasOwn(value, "campusId") ||
    Object.hasOwn(value, "openDepartmentId") ||
    (Object.hasOwn(value, "course") && Object.hasOwn(value, "semester"))
  ) {
    return { matched: true, value: compactSection(value) };
  }

  if (
    Object.hasOwn(value, "credit") ||
    Object.hasOwn(value, "hours") ||
    Object.hasOwn(value, "educationLevelId")
  ) {
    return { matched: true, value: compactCourse(value) };
  }

  if (
    Object.hasOwn(value, "nameCn") &&
    Object.hasOwn(value, "code") &&
    (Object.hasOwn(value, "startDate") || Object.hasOwn(value, "endDate")) &&
    !Object.hasOwn(value, "campusId")
  ) {
    return { matched: true, value: compactSemester(value) };
  }

  return { matched: false };
}
