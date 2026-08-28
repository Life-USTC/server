import { type CourseOccurrence, selectLatestCourses } from "./course-selection";
import { selectLatestExamBatches } from "./exam-batch-selection";
import {
  type CourseBuild,
  type DepartmentBuild,
  type ExamBatchBuild,
  firstChild,
  flattenDepartments,
  mapCourse,
  mapExamBatch,
  mapSemester,
  mapTeacherLessonType,
  mapTeacherTitle,
  type SemesterBuild,
  type TeacherLessonTypeBuild,
  type TeacherTitleBuild,
} from "./mappers";
import type { Snapshot } from "./snapshot";
import { asInt, asString } from "./snapshot-values";

export function loadSemesters(snapshot: Snapshot): SemesterBuild[] {
  return snapshot
    .queryAll("catalog_teach_semester_list")
    .map(mapSemester)
    .filter((semester): semester is SemesterBuild => semester != null);
}

export function loadDepartments(snapshot: Snapshot): DepartmentBuild[] {
  return flattenDepartments(
    snapshot.queryAll("catalog_teach_department_college_tree"),
    snapshot.queryAll("catalog_teach_department_college_tree_children"),
  );
}

export function loadCatalogLookups(snapshot: Snapshot) {
  function collect(table: string) {
    const byName = new Map<
      string,
      { nameCn: string; nameEn: string | undefined }
    >();
    for (const row of snapshot.queryAll(table)) {
      const nameCn = asString(row.cn);
      if (nameCn == null) continue;
      const nameEn = asString(row.en);
      const existing = byName.get(nameCn);
      if (existing == null || (existing.nameEn == null && nameEn != null)) {
        byName.set(nameCn, { nameCn, nameEn });
      }
    }
    return [...byName.values()];
  }

  return {
    courseCategories: collect(
      "catalog_teach_lesson_list_for_teach_courseCategory",
    ),
    courseClassifies: collect(
      "catalog_teach_lesson_list_for_teach_courseClassify",
    ),
    courseGradations: collect(
      "catalog_teach_lesson_list_for_teach_courseGradation",
    ),
    courseTypes: collect("catalog_teach_lesson_list_for_teach_courseType"),
    educationLevels: collect("catalog_teach_lesson_list_for_teach_education"),
    classTypes: collect("catalog_teach_lesson_list_for_teach_classType"),
    examModes: collect("catalog_teach_lesson_list_for_teach_examMode"),
    teachLanguages: collect("catalog_teach_lesson_list_for_teach_teachLang"),
  };
}

export function loadCourses(snapshot: Snapshot): {
  courses: CourseBuild[];
  courseJwIdByParentId: Map<number, number>;
} {
  const lessons = snapshot.queryAll("catalog_teach_lesson_list_for_teach");
  const courses = snapshot.queryGrouped(
    "catalog_teach_lesson_list_for_teach_course",
  );
  const types = snapshot.queryGrouped(
    "catalog_teach_lesson_list_for_teach_courseType",
  );
  const categories = snapshot.queryGrouped(
    "catalog_teach_lesson_list_for_teach_courseCategory",
  );
  const gradations = snapshot.queryGrouped(
    "catalog_teach_lesson_list_for_teach_courseGradation",
  );
  const classifies = snapshot.queryGrouped(
    "catalog_teach_lesson_list_for_teach_courseClassify",
  );
  const classTypes = snapshot.queryGrouped(
    "catalog_teach_lesson_list_for_teach_classType",
  );
  const educations = snapshot.queryGrouped(
    "catalog_teach_lesson_list_for_teach_education",
  );

  const occurrences: CourseOccurrence[] = [];
  const courseJwIdByParentId = new Map<number, number>();
  for (const lesson of lessons) {
    const parentId = asInt(lesson.store_id);
    if (parentId == null) continue;
    const course = mapCourse(lesson, firstChild(courses, parentId), {
      courseType: firstChild(types, parentId),
      courseCategory: firstChild(categories, parentId),
      courseGradation: firstChild(gradations, parentId),
      courseClassify: firstChild(classifies, parentId),
      classType: firstChild(classTypes, parentId),
      education: firstChild(educations, parentId),
    });
    if (course == null) continue;
    const existingJwId = courseJwIdByParentId.get(parentId);
    if (existingJwId != null && existingJwId !== course.jwId) {
      throw new Error(
        `Lesson parent ${parentId} maps to conflicting course jwIds`,
      );
    }
    courseJwIdByParentId.set(parentId, course.jwId);
    occurrences.push({
      semesterCode: asInt(lesson.semester_id) ?? 0,
      course,
    });
  }
  return {
    courses: selectLatestCourses(occurrences),
    courseJwIdByParentId,
  };
}

export function loadScheduleLookups(snapshot: Snapshot) {
  const titles: TeacherTitleBuild[] = [];
  const seenTitles = new Set<number>();
  for (const row of snapshot.queryAll(
    "jw_ws_schedule_table_datum_result_lessonList_teacherAssignmentList_title",
  )) {
    const title = mapTeacherTitle(row);
    if (title == null || seenTitles.has(title.jwId)) continue;
    seenTitles.add(title.jwId);
    titles.push(title);
  }

  const lessonTypes: TeacherLessonTypeBuild[] = [];
  const seenLessonTypes = new Set<number>();
  for (const row of snapshot.queryAll(
    "jw_ws_schedule_table_datum_result_lessonList_teacherAssignmentList_teacherLessonType",
  )) {
    const lessonType = mapTeacherLessonType(row);
    if (lessonType == null || seenLessonTypes.has(lessonType.jwId)) continue;
    seenLessonTypes.add(lessonType.jwId);
    lessonTypes.push(lessonType);
  }

  const batchOccurrences: Array<{
    semesterCode: number;
    examBatch: ExamBatchBuild;
  }> = [];
  for (const row of snapshot.queryAll("catalog_teach_exam_list_examBatch")) {
    const examBatch = mapExamBatch(row);
    if (examBatch == null) continue;
    batchOccurrences.push({
      semesterCode: asInt(row.semester_id) ?? 0,
      examBatch,
    });
  }

  return {
    teacherTitles: titles,
    teacherLessonTypes: lessonTypes,
    examBatches: selectLatestExamBatches(batchOccurrences),
  };
}
