import {
  firstChild,
  mapTeacherFromSchedule,
  mapTeacherFromScheduleAssignment,
} from "./mappers";
import type { Snapshot } from "./snapshot";
import { asInt, asString } from "./snapshot-values";
import {
  type CatalogTeacherOccurrence,
  planTeacherImport,
  type TeacherImportPlan,
  type TeacherOccurrence,
} from "./teacher-identity";

export function loadTeachers(snapshot: Snapshot): TeacherImportPlan {
  const scheduleLessons = snapshot.queryAll(
    "jw_ws_schedule_table_datum_result_lessonList",
  );
  const assignments = snapshot.queryGrouped(
    "jw_ws_schedule_table_datum_result_lessonList_teacherAssignmentList",
  );
  const contacts = snapshot.queryGrouped(
    "jw_ws_schedule_table_datum_result_lessonList_teacherAssignmentList_contactInfo",
  );
  const catalogAssignments = snapshot.queryGrouped(
    "catalog_teach_lesson_list_for_teach_teacherAssignmentList",
  );

  const scheduleOccurrences: TeacherOccurrence[] = [];
  const scheduleRowOccurrences = new Set<string>();
  for (const row of snapshot.queryAll(
    "jw_ws_schedule_table_datum_result_scheduleList",
  )) {
    const sectionJwId = asInt(row.lessonId);
    if (sectionJwId == null) continue;
    if (asString(row.personName) && asInt(row.teacherId) == null) {
      throw new Error(
        `Schedule teacher for section jwId ${sectionJwId} is missing teacherId`,
      );
    }
    const teacher = mapTeacherFromSchedule(row);
    if (teacher != null) {
      const semesterCode = asInt(row.semester_id) ?? 0;
      const key = `${sectionJwId}:${teacher.jwId}:${semesterCode}`;
      if (scheduleRowOccurrences.has(key)) continue;
      scheduleRowOccurrences.add(key);
      scheduleOccurrences.push({
        sectionJwId,
        semesterCode,
        teacher,
      });
    }
  }

  for (const lesson of scheduleLessons) {
    const sectionJwId = asInt(lesson.id);
    const parentId = asInt(lesson.store_id);
    if (sectionJwId == null || parentId == null) continue;
    for (const assignment of assignments.get(parentId) ?? []) {
      if (asString(assignment.name) && asInt(assignment.teacherId) == null) {
        throw new Error(
          `Teacher assignment for section jwId ${sectionJwId} is missing teacherId`,
        );
      }
      const teacher = mapTeacherFromScheduleAssignment(
        assignment,
        firstChild(contacts, asInt(assignment.store_id) ?? -1),
      );
      if (teacher != null) {
        scheduleOccurrences.push({
          sectionJwId,
          semesterCode:
            asInt(assignment.semester_id) ?? asInt(lesson.semester_id) ?? 0,
          teacher,
        });
      }
    }
  }

  const catalogOccurrences: CatalogTeacherOccurrence[] = [];
  for (const lesson of snapshot.queryAll(
    "catalog_teach_lesson_list_for_teach",
  )) {
    const sectionJwId = asInt(lesson.id);
    const parentId = asInt(lesson.store_id);
    if (sectionJwId == null || parentId == null) continue;
    for (const assignment of catalogAssignments.get(parentId) ?? []) {
      const nameCn = asString(assignment.cn);
      if (nameCn == null) continue;
      catalogOccurrences.push({
        sectionJwId,
        semesterCode:
          asInt(assignment.semester_id) ?? asInt(lesson.semester_id) ?? 0,
        teacher: {
          nameCn,
          nameEn: asString(assignment.en),
          departmentCode: asString(assignment.departmentCode),
        },
      });
    }
  }

  return planTeacherImport(scheduleOccurrences, catalogOccurrences);
}
