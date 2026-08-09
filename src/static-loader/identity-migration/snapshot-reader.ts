import { createHash } from "node:crypto";
import { selectLatestAdminClasses } from "../admin-class-selection";
import { selectLatestCourses } from "../course-selection";
import {
  firstChild,
  flattenDepartments,
  mapAdminClass,
  mapCampus,
  mapCampusFromSection,
  mapCourse,
  mapExam,
  mapExamBatch,
  mapTeacherFromScheduleAssignment,
  mapTeacherTitle,
} from "../mappers";
import { asInt, asString, Snapshot } from "../snapshot";
import type { SnapshotCourse, SnapshotState } from "./types";

const SYNTHETIC_JWID_BASE = 1_500_000_000;
const SYNTHETIC_JWID_SPAN = 400_000_000;

export function legacySemanticCourseJwId(sourceKey: string): number {
  const digest = createHash("sha256")
    .update(`course-variant:v1:${sourceKey}`)
    .digest("hex");
  return (
    SYNTHETIC_JWID_BASE +
    (Number.parseInt(digest.slice(0, 8), 16) % SYNTHETIC_JWID_SPAN)
  );
}

export function legacyCodeCourseJwId(code: string): number {
  const digest = createHash("sha256").update(`course:${code}`).digest("hex");
  return (
    SYNTHETIC_JWID_BASE +
    (Number.parseInt(digest.slice(0, 8), 16) % SYNTHETIC_JWID_SPAN)
  );
}

export function readIdentityMigrationSnapshot(
  path: string,
  sha256: string,
  minSemester = 401,
): SnapshotState {
  const snapshot = new Snapshot(path);
  try {
    const metadata = snapshot.metadata();
    if (metadata.schema_version !== "5") {
      throw new Error(
        `Unsupported snapshot schema version: ${metadata.schema_version ?? "unknown"}`,
      );
    }

    const lessons = snapshot.queryAll("catalog_teach_lesson_list_for_teach");
    const importedSectionJwIds = new Set(
      lessons
        .filter((row) => (asInt(row.semester_id) ?? 0) >= minSemester)
        .map((row) => asInt(row.id))
        .filter((id): id is number => id != null),
    );
    const coursesByLesson = snapshot.queryGrouped(
      "catalog_teach_lesson_list_for_teach_course",
    );
    const courseLookups = {
      courseType: snapshot.queryGrouped(
        "catalog_teach_lesson_list_for_teach_courseType",
      ),
      courseCategory: snapshot.queryGrouped(
        "catalog_teach_lesson_list_for_teach_courseCategory",
      ),
      courseGradation: snapshot.queryGrouped(
        "catalog_teach_lesson_list_for_teach_courseGradation",
      ),
      courseClassify: snapshot.queryGrouped(
        "catalog_teach_lesson_list_for_teach_courseClassify",
      ),
      classType: snapshot.queryGrouped(
        "catalog_teach_lesson_list_for_teach_classType",
      ),
      education: snapshot.queryGrouped(
        "catalog_teach_lesson_list_for_teach_education",
      ),
    };
    const courseOccurrences: Array<{
      semesterCode: number;
      course: ReturnType<typeof mapCourse> & {};
    }> = [];
    const sectionCourses: SnapshotState["sectionCourses"][number][] = [];
    for (const lesson of lessons) {
      const parentId = asInt(lesson.store_id);
      const sectionJwId = asInt(lesson.id);
      if (parentId == null || sectionJwId == null) continue;
      const courseRow = firstChild(coursesByLesson, parentId);
      const course = mapCourse(lesson, courseRow, {
        courseType: firstChild(courseLookups.courseType, parentId),
        courseCategory: firstChild(courseLookups.courseCategory, parentId),
        courseGradation: firstChild(courseLookups.courseGradation, parentId),
        courseClassify: firstChild(courseLookups.courseClassify, parentId),
        classType: firstChild(courseLookups.classType, parentId),
        education: firstChild(courseLookups.education, parentId),
      });
      if (course == null) continue;
      courseOccurrences.push({
        semesterCode: asInt(lesson.semester_id) ?? 0,
        course,
      });
      if (importedSectionJwIds.has(sectionJwId)) {
        sectionCourses.push({ sectionJwId, courseJwId: course.jwId });
      }
    }
    const courses: SnapshotCourse[] = selectLatestCourses(
      courseOccurrences,
    ).map((course) => ({
      jwId: course.jwId,
      code: course.code,
      nameCn: course.nameCn,
      legacySyntheticJwIds: [
        legacyCodeCourseJwId(course.code),
        legacySemanticCourseJwId(courseSourceIdentityKey(course)),
      ].sort((left, right) => left - right),
    }));

    const scheduleLessons = snapshot.queryAll(
      "jw_ws_schedule_table_datum_result_lessonList",
    );
    const adminRows = snapshot.queryGrouped(
      "jw_ws_schedule_table_datum_result_lessonList_adminclasses",
    );
    const adminOccurrences: Array<{
      semesterCode: number;
      adminClass: NonNullable<ReturnType<typeof mapAdminClass>>;
    }> = [];
    const sectionAdminClasses: SnapshotState["sectionAdminClasses"][number][] =
      [];
    for (const lesson of scheduleLessons) {
      const sectionJwId = asInt(lesson.id);
      const parentId = asInt(lesson.store_id);
      if (sectionJwId == null || parentId == null) continue;
      for (const row of adminRows.get(parentId) ?? []) {
        const adminClass = mapAdminClass(row);
        if (adminClass == null) continue;
        adminOccurrences.push({
          semesterCode:
            asInt(row.semester_id) ?? asInt(lesson.semester_id) ?? 0,
          adminClass,
        });
        if (importedSectionJwIds.has(sectionJwId)) {
          sectionAdminClasses.push({
            sectionJwId,
            adminClassJwId: adminClass.jwId,
          });
        }
      }
    }

    const teacherTitleRows = snapshot.queryAll(
      "jw_ws_schedule_table_datum_result_lessonList_teacherAssignmentList_title",
    );
    const teacherTitles = uniqueByJwId(
      teacherTitleRows.map(mapTeacherTitle).filter(isPresent),
    );

    const examRows = snapshot.queryAll("catalog_teach_exam_list");
    const examLessons = snapshot.queryGrouped("catalog_teach_exam_list_lesson");
    const examBatchRows = snapshot.queryGrouped(
      "catalog_teach_exam_list_examBatch",
    );
    const examBatches = uniqueByJwId(
      [...examBatchRows.values()].flat().map(mapExamBatch).filter(isPresent),
    );
    const examBatchesByExam: SnapshotState["examBatchesByExam"][number][] = [];
    for (const row of examRows) {
      const parentId = asInt(row.store_id);
      if (parentId == null) continue;
      const exam = mapExam(
        row,
        firstChild(examLessons, parentId),
        firstChild(examBatchRows, parentId),
        [],
      );
      if (
        exam?.examBatchJwId != null &&
        importedSectionJwIds.has(exam.sectionJwId)
      ) {
        examBatchesByExam.push({
          examJwId: exam.jwId,
          examBatchJwId: exam.examBatchJwId,
        });
      }
    }

    const departments = flattenDepartments(
      snapshot.queryAll("catalog_teach_department_college_tree"),
      snapshot.queryAll("catalog_teach_department_college_tree_children"),
    );
    const campuses: SnapshotState["campuses"][number][] = [];
    const buildingCampuses: SnapshotState["buildingCampuses"][number][] = [];
    const buildingRows = snapshot.queryAll(
      "jw_ws_schedule_table_datum_result_scheduleList_room_building",
    );
    const buildingCampusRows = snapshot.queryGrouped(
      "jw_ws_schedule_table_datum_result_scheduleList_room_building_campus",
    );
    for (const building of buildingRows) {
      const buildingJwId = asInt(building.id);
      const storeId = asInt(building.store_id);
      if (buildingJwId == null || storeId == null) continue;
      const campus = mapCampus(firstChild(buildingCampusRows, storeId) ?? {});
      if (campus?.jwId == null) continue;
      campuses.push({
        jwId: campus.jwId,
        nameCn: campus.nameCn,
        code: campus.code,
      });
      buildingCampuses.push({
        buildingJwId,
        campusJwId: campus.jwId,
      });
    }
    const catalogCampusRows = snapshot.queryGrouped(
      "catalog_teach_lesson_list_for_teach_campus",
    );
    const scheduleLessonByJwId = new Map(
      scheduleLessons
        .map((row) => [asInt(row.id), row] as const)
        .filter(
          (entry): entry is [number, (typeof entry)[1]] => entry[0] != null,
        ),
    );
    const sectionCampuses: SnapshotState["sectionCampuses"][number][] = [];
    for (const lesson of lessons) {
      const sectionJwId = asInt(lesson.id);
      const parentId = asInt(lesson.store_id);
      if (
        sectionJwId == null ||
        parentId == null ||
        !importedSectionJwIds.has(sectionJwId)
      ) {
        continue;
      }
      const campus = mapCampusFromSection(
        scheduleLessonByJwId.get(sectionJwId),
        firstChild(catalogCampusRows, parentId),
      );
      if (campus?.jwId == null) continue;
      campuses.push({
        jwId: campus.jwId,
        nameCn: campus.nameCn,
        code: campus.code,
      });
      sectionCampuses.push({
        sectionJwId,
        campusJwId: campus.jwId,
      });
    }
    const departmentCodeReferences: SnapshotState["departmentCodeReferences"][number][] =
      [];
    const openDepartments = snapshot.queryGrouped(
      "catalog_teach_lesson_list_for_teach_openDepartment",
    );
    for (const lesson of lessons) {
      const sectionJwId = asInt(lesson.id);
      const parentId = asInt(lesson.store_id);
      if (
        sectionJwId == null ||
        parentId == null ||
        !importedSectionJwIds.has(sectionJwId)
      ) {
        continue;
      }
      const departmentCode = asString(
        firstChild(openDepartments, parentId)?.code,
      );
      if (departmentCode != null) {
        departmentCodeReferences.push({
          ownerType: "section",
          ownerJwId: sectionJwId,
          departmentCode,
        });
      }
    }

    const assignmentRows = snapshot.queryGrouped(
      "jw_ws_schedule_table_datum_result_lessonList_teacherAssignmentList",
    );
    const contactRows = snapshot.queryGrouped(
      "jw_ws_schedule_table_datum_result_lessonList_teacherAssignmentList_contactInfo",
    );
    const titleRows = snapshot.queryGrouped(
      "jw_ws_schedule_table_datum_result_lessonList_teacherAssignmentList_title",
    );
    const teachers: SnapshotState["teachers"][number][] = [];
    const sectionTeachers: SnapshotState["sectionTeachers"][number][] = [];
    const teacherAssignments: SnapshotState["teacherAssignments"][number][] =
      [];
    for (const lesson of scheduleLessons) {
      const sectionJwId = asInt(lesson.id);
      const parentId = asInt(lesson.store_id);
      if (sectionJwId == null || parentId == null) continue;
      for (const row of assignmentRows.get(parentId) ?? []) {
        const assignmentId = asInt(row.store_id);
        const teacher = mapTeacherFromScheduleAssignment(
          row,
          assignmentId == null
            ? undefined
            : firstChild(contactRows, assignmentId),
          assignmentId == null
            ? undefined
            : firstChild(titleRows, assignmentId),
        );
        if (teacher?.teacherId == null) continue;
        teachers.push({
          jwId: teacher.teacherId,
          personId: teacher.personId,
          code: teacher.code,
          nameCn: teacher.nameCn,
        });
        if (teacher.departmentCode != null) {
          departmentCodeReferences.push({
            ownerType: "teacher",
            ownerJwId: teacher.teacherId,
            departmentCode: teacher.departmentCode,
          });
        }
        if (importedSectionJwIds.has(sectionJwId)) {
          sectionTeachers.push({
            sectionJwId,
            teacherJwId: teacher.teacherId,
          });
          teacherAssignments.push({
            sectionJwId,
            teacherJwId: teacher.teacherId,
            titleJwId: teacher.teacherTitleId ?? null,
          });
        }
      }
    }

    return {
      sha256,
      courses,
      sectionCourses: uniqueEdges(sectionCourses, "courseJwId"),
      adminClasses: selectLatestAdminClasses(adminOccurrences),
      sectionAdminClasses: uniqueEdges(sectionAdminClasses, "adminClassJwId"),
      teacherTitles,
      examBatches,
      examBatchesByExam: uniqueEdges(examBatchesByExam, "examBatchJwId"),
      departments,
      departmentCodeReferences: uniqueDepartmentReferences(
        departmentCodeReferences,
      ),
      campuses: uniqueByJwId(campuses),
      buildingCampuses: uniqueBuildingCampusEdges(buildingCampuses),
      sectionCampuses: uniqueEdges(sectionCampuses, "campusJwId"),
      teachers: uniqueTeacherRows(teachers),
      sectionTeachers: uniqueEdges(sectionTeachers, "teacherJwId"),
      teacherAssignments: uniqueAssignmentEdges(teacherAssignments),
    };
  } finally {
    snapshot.close();
  }
}

function courseSourceIdentityKey(course: {
  code: string;
  nameCn: string;
  nameEn?: string;
  categoryName?: string;
  classTypeName?: string;
  classifyName?: string;
  educationLevelName?: string;
  gradationName?: string;
  typeName?: string;
}) {
  const optional = (value?: string) => value?.trim() || null;
  return JSON.stringify([
    course.code.trim(),
    course.nameCn.trim(),
    optional(course.nameEn),
    optional(course.categoryName),
    optional(course.classTypeName),
    optional(course.classifyName),
    optional(course.educationLevelName),
    optional(course.gradationName),
    optional(course.typeName),
  ]);
}

function uniqueByJwId<T extends { jwId: number }>(rows: T[]): T[] {
  return [...new Map(rows.map((row) => [row.jwId, row])).values()];
}

function uniqueEdges<
  K extends string,
  T extends { sectionJwId?: number; examJwId?: number } & Record<K, number>,
>(rows: T[], target: K): T[] {
  return [
    ...new Map(
      rows.map((row) => [
        `${row.sectionJwId ?? row.examJwId}:${row[target]}`,
        row,
      ]),
    ).values(),
  ];
}

function uniqueAssignmentEdges(
  rows: SnapshotState["teacherAssignments"][number][],
) {
  return [
    ...new Map(
      rows.map((row) => [
        `${row.sectionJwId}:${row.teacherJwId}:${row.titleJwId ?? ""}`,
        row,
      ]),
    ).values(),
  ];
}

function uniqueTeacherRows(rows: SnapshotState["teachers"][number][]) {
  return [
    ...new Map(
      rows.map((row) => [
        JSON.stringify([row.jwId, row.personId, row.code, row.nameCn]),
        row,
      ]),
    ).values(),
  ];
}

function uniqueDepartmentReferences(
  rows: SnapshotState["departmentCodeReferences"][number][],
) {
  return [
    ...new Map(
      rows.map((row) => [
        `${row.ownerType}:${row.ownerJwId}:${row.departmentCode}`,
        row,
      ]),
    ).values(),
  ];
}

function uniqueBuildingCampusEdges(
  rows: SnapshotState["buildingCampuses"][number][],
) {
  return [
    ...new Map(
      rows.map((row) => [`${row.buildingJwId}:${row.campusJwId}`, row]),
    ).values(),
  ];
}

function isPresent<T>(value: T | undefined): value is T {
  return value != null;
}
