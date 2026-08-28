import {
  type AdminClassSectionPair,
  type ExamBuild,
  firstChild,
  mapExam,
  mapSchedule,
  mapScheduleGroup,
  mapSection,
  mapTeacherAssignment,
  mergeSchedule,
  type ScheduleBuild,
  type ScheduleGroupBuild,
  type SectionBuild,
  type SectionTeacherPair,
  scheduleKey,
  type TeacherAssignmentBuild,
} from "./mappers";
import type { Snapshot } from "./snapshot";
import { asInt, asString, type SnapshotRow } from "./snapshot-values";
import { sectionTeacherNameKey } from "./teacher-identity";

export function loadSections(
  snapshot: Snapshot,
  minSemester: number,
  courseJwIdByParentId: Map<number, number>,
  catalogTeacherJwIdBySectionName: Map<string, number>,
  sectionTeacherPairs: SectionTeacherPair[],
): SectionBuild[] {
  const scheduleLessonMap = new Map<number, SnapshotRow>();
  for (const row of snapshot.queryAll(
    "jw_ws_schedule_table_datum_result_lessonList",
  )) {
    const id = asInt(row.id);
    if (id != null) scheduleLessonMap.set(id, row);
  }
  const requiredInfo = snapshot.queryGrouped(
    "jw_ws_schedule_table_datum_result_lessonList_requiredPeriodInfo",
  );
  const suggestWeeks = snapshot.queryGrouped(
    "jw_ws_schedule_table_datum_result_lessonList_suggestScheduleWeeks",
  );
  const jsonParams = snapshot.queryGrouped(
    "jw_ws_schedule_table_datum_result_lessonList_scheduleJsonParams",
  );
  const courses = snapshot.queryGrouped(
    "catalog_teach_lesson_list_for_teach_course",
  );
  const openDepartments = snapshot.queryGrouped(
    "catalog_teach_lesson_list_for_teach_openDepartment",
  );
  const examModes = snapshot.queryGrouped(
    "catalog_teach_lesson_list_for_teach_examMode",
  );
  const teachLanguages = snapshot.queryGrouped(
    "catalog_teach_lesson_list_for_teach_teachLang",
  );
  const peopleText = snapshot.queryGrouped(
    "catalog_teach_lesson_list_for_teach_dateTimePlacePersonText",
  );
  const catalogAssignments = snapshot.queryGrouped(
    "catalog_teach_lesson_list_for_teach_teacherAssignmentList",
  );

  const sections: SectionBuild[] = [];
  for (const lesson of snapshot.queryAll(
    "catalog_teach_lesson_list_for_teach",
  )) {
    const semesterCode = asInt(lesson.semester_id);
    const parentId = asInt(lesson.store_id);
    if (
      semesterCode == null ||
      semesterCode < minSemester ||
      parentId == null
    ) {
      continue;
    }
    const courseJwId = courseJwIdByParentId.get(parentId);
    if (courseJwId == null) {
      throw new Error(`Course jwId is missing for lesson parent ${parentId}`);
    }
    const scheduleLesson = scheduleLessonMap.get(asInt(lesson.id) ?? -1);
    const scheduleStoreId = asInt(scheduleLesson?.store_id);
    const section = mapSection(
      lesson,
      scheduleLesson,
      scheduleStoreId == null
        ? undefined
        : firstChild(requiredInfo, scheduleStoreId),
      scheduleStoreId == null ? undefined : suggestWeeks.get(scheduleStoreId),
      scheduleStoreId == null ? undefined : jsonParams.get(scheduleStoreId),
      peopleText.get(parentId),
      {
        course: firstChild(courses, parentId),
        examMode: firstChild(examModes, parentId),
        openDepartment: firstChild(openDepartments, parentId),
        teachLanguage: firstChild(teachLanguages, parentId),
      },
    );
    if (section == null) continue;
    sections.push(section);

    for (const assignment of catalogAssignments.get(parentId) ?? []) {
      const teacherJwId = catalogTeacherJwIdBySectionName.get(
        sectionTeacherNameKey(section.jwId, asString(assignment.cn) ?? ""),
      );
      if (teacherJwId != null) {
        sectionTeacherPairs.push({ sectionJwId: section.jwId, teacherJwId });
      }
    }
  }
  return sections;
}

export function loadScheduleData(
  snapshot: Snapshot,
  importedSectionJwIds: Set<number>,
  teacherAssignments: TeacherAssignmentBuild[],
  adminClassSectionPairs: AdminClassSectionPair[],
): {
  scheduleGroups: ScheduleGroupBuild[];
  schedules: ScheduleBuild[];
  scheduleInfrastructureTeacherPairs: SectionTeacherPair[];
} {
  const scheduleLessons = snapshot.queryAll(
    "jw_ws_schedule_table_datum_result_lessonList",
  );
  const assignments = snapshot.queryGrouped(
    "jw_ws_schedule_table_datum_result_lessonList_teacherAssignmentList",
  );
  const lessonTypes = snapshot.queryGrouped(
    "jw_ws_schedule_table_datum_result_lessonList_teacherAssignmentList_teacherLessonType",
  );
  const titles = snapshot.queryGrouped(
    "jw_ws_schedule_table_datum_result_lessonList_teacherAssignmentList_title",
  );
  const weekIndices = snapshot.queryGrouped(
    "jw_ws_schedule_table_datum_result_lessonList_teacherAssignmentList_weekIndices",
  );
  const adminClasses = snapshot.queryGrouped(
    "jw_ws_schedule_table_datum_result_lessonList_adminclasses",
  );

  const teacherJwIdBySectionPerson = new Map<string, number>();
  for (const lesson of scheduleLessons) {
    const sectionJwId = asInt(lesson.id);
    const parentId = asInt(lesson.store_id);
    if (
      sectionJwId == null ||
      parentId == null ||
      !importedSectionJwIds.has(sectionJwId)
    ) {
      continue;
    }
    for (const assignment of assignments.get(parentId) ?? []) {
      const teacherJwId = asInt(assignment.teacherId);
      if (asString(assignment.name) && teacherJwId == null) {
        throw new Error(
          `Teacher assignment for section jwId ${sectionJwId} is missing teacherId`,
        );
      }
      const personId = asInt(assignment.personId);
      if (teacherJwId == null || personId == null) continue;
      const key = `${sectionJwId}:${personId}`;
      const existing = teacherJwIdBySectionPerson.get(key);
      if (existing != null && existing !== teacherJwId) {
        throw new Error(
          `Section jwId ${sectionJwId} personId ${personId} maps to multiple teacherIds: ${existing}, ${teacherJwId}`,
        );
      }
      teacherJwIdBySectionPerson.set(key, teacherJwId);
    }
  }

  const scheduleGroups: ScheduleGroupBuild[] = [];
  const seenGroups = new Set<number>();
  for (const row of snapshot.queryAll(
    "jw_ws_schedule_table_datum_result_scheduleGroupList",
  )) {
    const sectionJwId = asInt(row.lessonId);
    if (sectionJwId == null || !importedSectionJwIds.has(sectionJwId)) continue;
    const group = mapScheduleGroup(row);
    if (group == null) {
      throw new Error(
        `ScheduleGroup for Section jwId ${sectionJwId} has no valid upstream jwId`,
      );
    }
    if (seenGroups.has(group.jwId)) continue;
    seenGroups.add(group.jwId);
    scheduleGroups.push(group);
  }

  const schedulesByKey = new Map<string, ScheduleBuild>();
  const scheduleTeacherPairs: SectionTeacherPair[] = [];
  const scheduleTeacherPairKeys = new Set<string>();
  const addScheduleTeacherPair = (sectionJwId: number, teacherJwId: number) => {
    const key = `${sectionJwId}:${teacherJwId}`;
    if (scheduleTeacherPairKeys.has(key)) return;
    scheduleTeacherPairKeys.add(key);
    scheduleTeacherPairs.push({ sectionJwId, teacherJwId });
  };
  const rooms = snapshot.queryGrouped(
    "jw_ws_schedule_table_datum_result_scheduleList_room",
  );
  for (const row of snapshot.queryAll(
    "jw_ws_schedule_table_datum_result_scheduleList",
  )) {
    const sectionJwId = asInt(row.lessonId);
    if (sectionJwId == null || !importedSectionJwIds.has(sectionJwId)) continue;
    if (asInt(row.scheduleGroupId) == null) {
      throw new Error(
        `Schedule for Section jwId ${sectionJwId} is missing scheduleGroupId`,
      );
    }
    const roomJwId =
      asInt(firstChild(rooms, asInt(row.store_id) ?? -1)?.id) ??
      asInt(row.roomId);
    const key = scheduleKey(row, roomJwId);
    const personId = asInt(row.personId);
    const teacherJwId =
      asInt(row.teacherId) ??
      (personId == null
        ? undefined
        : teacherJwIdBySectionPerson.get(`${sectionJwId}:${personId}`));
    if (personId != null && teacherJwId == null) {
      throw new Error(
        `Schedule for section jwId ${sectionJwId} personId ${personId} did not resolve to a teacherId`,
      );
    }
    if (teacherJwId != null) {
      addScheduleTeacherPair(sectionJwId, teacherJwId);
    }
    const existing = schedulesByKey.get(key);
    if (existing == null) {
      schedulesByKey.set(key, mapSchedule(row, teacherJwId, roomJwId));
    } else {
      mergeSchedule(existing, row, teacherJwId, roomJwId);
    }
  }

  for (const lesson of scheduleLessons) {
    const sectionJwId = asInt(lesson.id);
    const parentId = asInt(lesson.store_id);
    if (
      sectionJwId == null ||
      parentId == null ||
      !importedSectionJwIds.has(sectionJwId)
    ) {
      continue;
    }
    for (const assignment of assignments.get(parentId) ?? []) {
      const teacherJwId = asInt(assignment.teacherId);
      if (teacherJwId != null) {
        addScheduleTeacherPair(sectionJwId, teacherJwId);
      }
      const assignmentStoreId = asInt(assignment.store_id) ?? -1;
      const teacherAssignment = mapTeacherAssignment(
        sectionJwId,
        assignment,
        weekIndices.get(assignmentStoreId) ?? [],
        asInt(firstChild(lessonTypes, assignmentStoreId)?.id),
        asInt(firstChild(titles, assignmentStoreId)?.id),
      );
      if (teacherAssignment != null) teacherAssignments.push(teacherAssignment);
    }
    for (const adminClass of adminClasses.get(parentId) ?? []) {
      const adminClassJwId = asInt(adminClass.id);
      if (adminClassJwId != null) {
        adminClassSectionPairs.push({ adminClassJwId, sectionJwId });
      }
    }
  }

  return {
    scheduleGroups,
    schedules: [...schedulesByKey.values()],
    scheduleInfrastructureTeacherPairs: scheduleTeacherPairs,
  };
}

export function loadExams(
  snapshot: Snapshot,
  importedSectionJwIds: Set<number>,
): ExamBuild[] {
  const lessons = snapshot.queryGrouped("catalog_teach_exam_list_lesson");
  const batches = snapshot.queryGrouped("catalog_teach_exam_list_examBatch");
  const rooms = snapshot.queryGrouped("catalog_teach_exam_list_examRooms");
  const result: ExamBuild[] = [];
  for (const row of snapshot.queryAll("catalog_teach_exam_list")) {
    const parentId = asInt(row.store_id);
    if (parentId == null) continue;
    const lesson = firstChild(lessons, parentId);
    const sectionJwId = asInt(lesson?.id);
    if (sectionJwId == null || !importedSectionJwIds.has(sectionJwId)) continue;
    const exam = mapExam(
      row,
      lesson,
      firstChild(batches, parentId),
      rooms.get(parentId) ?? [],
    );
    if (exam == null) {
      throw new Error(
        `Exam for Section jwId ${sectionJwId} has no valid upstream jwId`,
      );
    }
    result.push(exam);
  }
  return result;
}
