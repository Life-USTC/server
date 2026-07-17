import type { Prisma, PrismaClient } from "../generated/prisma-node/client";
import {
  type AdminClassOccurrence,
  canonicalizeAdminClasses,
} from "./admin-class-identity";
import {
  courseIdentitySignature,
  type IncomingCourseIdentityRecord,
  planCourseIdentityImport,
} from "./course-identity";
import {
  assertCourseJwIdNamespace,
  mergeLegacyCourseDuplicates,
} from "./course-merge";
import {
  type AdminClassSectionPair,
  type BuildingBuild,
  type CampusBuild,
  type CourseBuild,
  type DepartmentBuild,
  type DepartmentPlaceholderRequest,
  type ExamBatchBuild,
  type ExamBuild,
  firstChild,
  mapAdminClass,
  mapBuilding,
  mapCampus,
  mapCampusFromSection,
  mapCourse,
  mapExam,
  mapExamBatch,
  mapRoom,
  mapRoomType,
  mapSchedule,
  mapScheduleGroup,
  mapSection,
  mapSemester,
  mapTeacherAssignment,
  mapTeacherFromCatalogAssignment,
  mapTeacherFromScheduleAssignment,
  mapTeacherLessonType,
  mapTeacherTitle,
  mergeSchedule,
  type RoomBuild,
  type RoomTypeBuild,
  type ScheduleBuild,
  type ScheduleGroupBuild,
  type SectionBuild,
  type SectionTeacherPair,
  type SemesterBuild,
  scheduleKey,
  stablePlaceholderCode,
  type TeacherAssignmentBuild,
  type TeacherBuild,
  type TeacherLessonTypeBuild,
  type TeacherTitleBuild,
} from "./mappers";
import {
  asBoolean,
  asInt,
  asString,
  Snapshot,
  type SnapshotRow,
} from "./snapshot";
import {
  planTeacherImport,
  sectionTeacherNameKey,
  type TeacherIdentityReference,
  type TeacherImportPlan,
  type TeacherOccurrence,
} from "./teacher-identity";
import { reconcileCatalogTeacherFallbacks } from "./teacher-reconciliation";
import {
  requireCourseDatabaseId,
  requireCourseSourceKey,
  sectionConflictUpdateColumns,
} from "./upsert-policy";
import {
  missingSnapshotRowsWhere,
  validateSnapshotCompleteness,
} from "./validation";

export type ImportConfig = {
  snapshotPath: string;
  minSemester: number;
  dryRun: boolean;
};

export type ImportStats = {
  semesters: number;
  departments: number;
  courses: number;
  sections: number;
  teachers: number;
  scheduleGroups: number;
  schedules: number;
  exams: number;
  rooms: number;
  buildings: number;
  campuses: number;
  adminClasses: number;
};

export async function runImport(
  prisma: PrismaClient,
  config: ImportConfig,
): Promise<ImportStats> {
  const snapshot = new Snapshot(config.snapshotPath);
  const metadata = snapshot.metadata();
  const schemaVersion = metadata.schema_version;
  try {
    if (schemaVersion !== "5") {
      throw new Error(
        `Unsupported snapshot schema version: ${schemaVersion ?? "unknown"}`,
      );
    }
    validateSnapshotCompleteness(
      {
        metadata,
        semesterRows: snapshot.queryAll("catalog_teach_semester_list"),
        catalogLessonRows: snapshot.queryAll(
          "catalog_teach_lesson_list_for_teach",
        ),
        fetchRows: snapshot.queryAll("upstream_fetches"),
      },
      config.minSemester,
    );
  } catch (error) {
    snapshot.close();
    throw error;
  }

  const allSectionJwIds = new Set<number>();
  const sectionTeacherPairs: SectionTeacherPair[] = [];
  const teacherAssignments: TeacherAssignmentBuild[] = [];
  const adminClassSectionPairs: AdminClassSectionPair[] = [];

  const semesters = loadSemesters(snapshot);
  const departments = loadDepartments(snapshot);

  const {
    courseCategories,
    courseClassifies,
    courseGradations,
    courseTypes,
    educationLevels,
    classTypes,
    examModes,
    teachLanguages,
  } = loadCatalogLookups(snapshot);

  const { courses, courseSourceKeyByParentId } = loadCourses(snapshot);

  const { teacherTitles, teacherLessonTypes, examBatches } =
    loadScheduleLookups(snapshot);

  const { teachers, sectionTeacherIdentities, catalogFallbackResolutions } =
    loadTeachers(snapshot);

  const {
    campuses,
    campusNameByJwId,
    roomTypes,
    buildings,
    rooms,
    adminClasses,
  } = loadScheduleInfrastructure(snapshot);

  const { sections, placeholderDepartments: sectionPlaceholderDepartments } =
    loadSections(
      snapshot,
      config.minSemester,
      courseSourceKeyByParentId,
      sectionTeacherIdentities,
      (sectionJwId) => allSectionJwIds.add(sectionJwId),
      sectionTeacherPairs,
    );

  const placeholderDepartments = mergePlaceholderDepartments(
    sectionPlaceholderDepartments,
    teachers,
    departments,
  );

  const { scheduleGroups, schedules, scheduleInfrastructureTeacherPairs } =
    loadScheduleData(
      snapshot,
      allSectionJwIds,
      teacherAssignments,
      adminClassSectionPairs,
    );

  for (const pair of scheduleInfrastructureTeacherPairs) {
    sectionTeacherPairs.push(pair);
  }

  const exams = loadExams(snapshot, allSectionJwIds);

  async function logStep<T>(
    name: string,
    count: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    const start = Date.now();
    console.log(`[${new Date().toISOString()}] ${name}: ${count} items...`);
    const result = await fn();
    console.log(
      `[${new Date().toISOString()}] ${name}: done in ${Date.now() - start}ms`,
    );
    return result;
  }

  const runInTransaction = async (tx: Prisma.TransactionClient) => {
    const semesterMap = await logStep("upsertSemesters", semesters.length, () =>
      upsertSemesters(tx, semesters),
    );
    const departmentMap = await logStep(
      "upsertDepartments",
      departments.length + placeholderDepartments.length,
      () => upsertDepartments(tx, departments, placeholderDepartments),
    );
    const lookupMaps = await logStep("loadLookupTables", 8, () =>
      loadLookupTables(tx, {
        courseCategories,
        courseClassifies,
        courseGradations,
        courseTypes,
        educationLevels,
        classTypes,
        examModes,
        teachLanguages,
      }),
    );
    const courseImport = await logStep("upsertCourses", courses.length, () =>
      upsertCourses(tx, courses, lookupMaps),
    );
    const courseMap = courseImport.map;
    const teacherTitleMap = await logStep(
      "upsertTeacherTitles",
      teacherTitles.length,
      () => upsertTeacherTitles(tx, teacherTitles),
    );
    const teacherLessonTypeMap = await logStep(
      "upsertTeacherLessonTypes",
      teacherLessonTypes.length,
      () => upsertTeacherLessonTypes(tx, teacherLessonTypes),
    );
    const examBatchMap = await logStep(
      "upsertExamBatches",
      examBatches.length,
      () => upsertExamBatches(tx, examBatches),
    );
    const teacherMap = await logStep("upsertTeachers", teachers.length, () =>
      upsertTeachers(tx, teachers, departmentMap, teacherTitleMap),
    );
    const campusMap = await logStep("upsertCampuses", campuses.length, () =>
      upsertCampuses(tx, campuses, campusNameByJwId),
    );
    const roomTypeMap = await logStep("upsertRoomTypes", roomTypes.length, () =>
      upsertRoomTypes(tx, roomTypes),
    );
    const buildingMap = await logStep("upsertBuildings", buildings.length, () =>
      upsertBuildings(tx, buildings, campusMap.byJwId),
    );
    const roomMap = await logStep("upsertRooms", rooms.length, () =>
      upsertRooms(tx, rooms, buildingMap, roomTypeMap),
    );
    const adminClassMap = await logStep(
      "upsertAdminClasses",
      adminClasses.length,
      () => upsertAdminClasses(tx, adminClasses),
    );
    const sectionMap = await logStep("upsertSections", sections.length, () =>
      upsertSections(
        tx,
        sections,
        semesterMap,
        departmentMap,
        courseMap,
        lookupMaps,
        campusMap,
        roomTypeMap,
      ),
    );
    const scheduleGroupMap = await logStep(
      "upsertScheduleGroups",
      scheduleGroups.length,
      () => upsertScheduleGroups(tx, scheduleGroups, sectionMap),
    );

    const sectionDbIds = Array.from(sectionMap.values());
    await logStep("writeSectionTeachers", sectionTeacherPairs.length, () =>
      writeSectionTeachers(
        tx,
        sectionMap,
        teacherMap,
        sectionTeacherPairs,
        sectionDbIds,
      ),
    );
    await logStep("writeTeacherAssignments", teacherAssignments.length, () =>
      writeTeacherAssignments(
        tx,
        teacherAssignments,
        sectionMap,
        teacherMap,
        teacherLessonTypeMap,
      ),
    );
    await logStep(
      "writeAdminClassSections",
      adminClassSectionPairs.length,
      () =>
        writeAdminClassSections(
          tx,
          adminClassSectionPairs,
          sectionMap,
          adminClassMap,
        ),
    );

    await logStep("writeSchedules", schedules.length, () =>
      writeSchedules(
        tx,
        schedules,
        sectionMap,
        scheduleGroupMap,
        roomMap,
        teacherMap,
        sectionDbIds,
      ),
    );
    await logStep(
      "reconcileCatalogTeacherFallbacks",
      catalogFallbackResolutions.length,
      () =>
        reconcileCatalogTeacherFallbacks(tx, catalogFallbackResolutions, {
          resolveDepartmentId: (departmentCode) =>
            departmentMap.get(departmentCode ?? UNKNOWN_DEPARTMENT_CODE),
          resolveTargetId: (identity) =>
            requireConsistentTeacherIdentityId(identity, teacherMap),
        }),
    );

    const examMap = await logStep("upsertExams", exams.length, () =>
      upsertExams(tx, exams, sectionMap, examBatchMap),
    );
    await logStep("writeExamRooms", exams.length, () =>
      writeExamRooms(tx, exams, examMap),
    );
    await logStep(
      "reconcileRemovedSnapshotRows",
      scheduleGroups.length + exams.length,
      async () => {
        const scheduleGroupWhere = missingSnapshotRowsWhere(
          sectionDbIds,
          scheduleGroups.map((group) => group.jwId),
        );
        if (scheduleGroupWhere != null) {
          await tx.scheduleGroup.deleteMany({ where: scheduleGroupWhere });
        }
        const examWhere = missingSnapshotRowsWhere(
          sectionDbIds,
          exams.map((exam) => exam.jwId),
        );
        if (examWhere != null) {
          await tx.exam.deleteMany({ where: examWhere });
        }
      },
    );
    await logStep(
      "mergeLegacyCourseDuplicates",
      courseImport.incomingCourses.length,
      () =>
        mergeLegacyCourseDuplicates(
          tx,
          courseImport.incomingCourses,
          courseImport.canonicalJwIds,
        ),
    );

    if (config.dryRun) {
      throw new Error("DRY_RUN: rolling back transaction");
    }
  };

  try {
    await prisma.$transaction(runInTransaction, {
      maxWait: 60_000,
      timeout: 7_200_000,
    });
  } catch (error) {
    if (
      config.dryRun &&
      error instanceof Error &&
      error.message.startsWith("DRY_RUN")
    ) {
      console.log("dry run complete, transaction rolled back");
    } else {
      throw error;
    }
  } finally {
    snapshot.close();
  }

  if (config.dryRun) {
    return {
      semesters: semesters.length,
      departments: departments.length + placeholderDepartments.length,
      courses: courses.length,
      sections: sections.length,
      teachers: teachers.length,
      scheduleGroups: scheduleGroups.length,
      schedules: schedules.length,
      exams: exams.length,
      rooms: rooms.length,
      buildings: buildings.length,
      campuses: campuses.length,
      adminClasses: adminClasses.length,
    };
  }

  return countStats(prisma);
}

function loadSemesters(snapshot: Snapshot): SemesterBuild[] {
  const rows = snapshot.queryAll("catalog_teach_semester_list");
  return rows.map(mapSemester).filter((s): s is SemesterBuild => s != null);
}

function loadDepartments(snapshot: Snapshot): DepartmentBuild[] {
  const rows = snapshot.queryAll("catalog_teach_department_college_tree");
  const children = snapshot.queryAll(
    "catalog_teach_department_college_tree_children",
  );
  return flattenDepartments(rows, children);
}

function flattenDepartments(
  rows: SnapshotRow[],
  childrenRows: SnapshotRow[],
): DepartmentBuild[] {
  const childrenMap = new Map<number, SnapshotRow[]>();
  for (const row of childrenRows) {
    const parentId = asInt(row.parent_store_id);
    if (parentId == null) continue;
    const list = childrenMap.get(parentId) ?? [];
    list.push(row);
    childrenMap.set(parentId, list);
  }

  const result: DepartmentBuild[] = [];
  const seen = new Set<string>();

  function add(row: SnapshotRow) {
    const code = asString(row.code);
    const nameCn = asString(row.nameZh) ?? asString(row.name);
    if (!code || !nameCn) return;
    if (seen.has(code)) return;
    seen.add(code);
    result.push({
      code,
      nameCn,
      nameEn: asString(row.nameEn),
      isCollege: asBoolean(row.isCollege),
    });
    const parentStoreId = asInt(row.store_id);
    if (parentStoreId == null) return;
    for (const child of childrenMap.get(parentStoreId) ?? []) {
      add(child);
    }
  }

  for (const row of rows) {
    add(row);
  }
  return result;
}

function loadCatalogLookups(snapshot: Snapshot) {
  function collect(table: string) {
    return snapshot
      .queryAll(table)
      .map((row) => ({ nameCn: asString(row.cn), nameEn: asString(row.en) }))
      .filter(
        (l): l is { nameCn: string; nameEn: string | undefined } =>
          l.nameCn != null,
      );
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

function loadCourses(snapshot: Snapshot): {
  courses: CourseBuild[];
  courseSourceKeyByParentId: Map<number, string>;
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

  const coursesBySourceAlias = new Map<string, CourseBuild>();
  const courseSourceKeyByParentId = new Map<number, string>();
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
    const existingSourceKey = courseSourceKeyByParentId.get(parentId);
    if (existingSourceKey != null && existingSourceKey !== course.sourceKey) {
      throw new Error(
        `Lesson parent ${parentId} maps to conflicting course identities`,
      );
    }
    courseSourceKeyByParentId.set(parentId, course.sourceKey);
    coursesBySourceAlias.set(`${course.jwId}:${course.sourceKey}`, course);
  }
  return {
    courses: [...coursesBySourceAlias.values()],
    courseSourceKeyByParentId,
  };
}

function loadScheduleLookups(snapshot: Snapshot) {
  const titleRows = snapshot.queryAll(
    "jw_ws_schedule_table_datum_result_lessonList_teacherAssignmentList_title",
  );
  const lessonTypeRows = snapshot.queryAll(
    "jw_ws_schedule_table_datum_result_lessonList_teacherAssignmentList_teacherLessonType",
  );
  const examBatchRows = snapshot.queryAll("catalog_teach_exam_list_examBatch");

  const titles: TeacherTitleBuild[] = [];
  const seenTitles = new Set<number>();
  for (const row of titleRows) {
    const t = mapTeacherTitle(row);
    if (t == null || seenTitles.has(t.jwId)) continue;
    seenTitles.add(t.jwId);
    titles.push(t);
  }

  const lessonTypes: TeacherLessonTypeBuild[] = [];
  const seenLessonTypes = new Set<number>();
  for (const row of lessonTypeRows) {
    const t = mapTeacherLessonType(row);
    if (t == null || seenLessonTypes.has(t.jwId)) continue;
    seenLessonTypes.add(t.jwId);
    lessonTypes.push(t);
  }

  const batches: ExamBatchBuild[] = [];
  const seenBatches = new Set<string>();
  for (const row of examBatchRows) {
    const b = mapExamBatch(row);
    if (b == null || seenBatches.has(b.nameCn)) continue;
    seenBatches.add(b.nameCn);
    batches.push(b);
  }

  return {
    teacherTitles: titles,
    teacherLessonTypes: lessonTypes,
    examBatches: batches,
  };
}

function loadTeachers(snapshot: Snapshot): TeacherImportPlan {
  const scheduleLessonRows = snapshot.queryAll(
    "jw_ws_schedule_table_datum_result_lessonList",
  );
  const assignmentRows = snapshot.queryGrouped(
    "jw_ws_schedule_table_datum_result_lessonList_teacherAssignmentList",
  );
  const contactRows = snapshot.queryGrouped(
    "jw_ws_schedule_table_datum_result_lessonList_teacherAssignmentList_contactInfo",
  );
  const titleRows = snapshot.queryGrouped(
    "jw_ws_schedule_table_datum_result_lessonList_teacherAssignmentList_title",
  );

  const catalogAssignmentRows = snapshot.queryGrouped(
    "catalog_teach_lesson_list_for_teach_teacherAssignmentList",
  );

  const scheduleOccurrences: TeacherOccurrence[] = [];
  const catalogOccurrences: TeacherOccurrence[] = [];

  for (const lesson of scheduleLessonRows) {
    const lessonId = asInt(lesson.id);
    if (lessonId == null) continue;
    const parentId = asInt(lesson.store_id);
    if (parentId == null) continue;
    for (const assignment of assignmentRows.get(parentId) ?? []) {
      const contact = firstChild(contactRows, asInt(assignment.store_id) ?? -1);
      const title = firstChild(titleRows, asInt(assignment.store_id) ?? -1);
      const build = mapTeacherFromScheduleAssignment(
        assignment,
        contact,
        title,
      );
      if (build == null) continue;
      scheduleOccurrences.push({
        sectionJwId: lessonId,
        semesterCode:
          asInt(assignment.semester_id) ?? asInt(lesson.semester_id) ?? 0,
        teacher: build,
      });
    }
  }

  const lessons = snapshot.queryAll("catalog_teach_lesson_list_for_teach");
  for (const lesson of lessons) {
    const lessonId = asInt(lesson.id);
    if (lessonId == null) continue;
    const parentId = asInt(lesson.store_id);
    if (parentId == null) continue;
    for (const assignment of catalogAssignmentRows.get(parentId) ?? []) {
      const build = mapTeacherFromCatalogAssignment(assignment);
      if (build == null) continue;
      catalogOccurrences.push({
        sectionJwId: lessonId,
        semesterCode:
          asInt(assignment.semester_id) ?? asInt(lesson.semester_id) ?? 0,
        teacher: build,
      });
    }
  }

  return planTeacherImport(scheduleOccurrences, catalogOccurrences);
}

function loadScheduleInfrastructure(snapshot: Snapshot) {
  const roomRows = snapshot.queryAll(
    "jw_ws_schedule_table_datum_result_scheduleList_room",
  );
  const buildingRows = snapshot.queryGrouped(
    "jw_ws_schedule_table_datum_result_scheduleList_room_building",
  );
  const campusRows = snapshot.queryGrouped(
    "jw_ws_schedule_table_datum_result_scheduleList_room_building_campus",
  );
  const roomTypeRows = snapshot.queryGrouped(
    "jw_ws_schedule_table_datum_result_scheduleList_room_roomType",
  );
  const adminClassRows = snapshot.queryAll(
    "jw_ws_schedule_table_datum_result_lessonList_adminclasses",
  );
  const catalogLessonRows = snapshot.queryAll(
    "catalog_teach_lesson_list_for_teach",
  );
  const catalogCampusRows = snapshot.queryGrouped(
    "catalog_teach_lesson_list_for_teach_campus",
  );
  const scheduleLessonRows = snapshot.queryAll(
    "jw_ws_schedule_table_datum_result_lessonList",
  );
  const scheduleLessonById = new Map<number, SnapshotRow>();
  for (const row of scheduleLessonRows) {
    const lessonId = asInt(row.id);
    if (lessonId != null) scheduleLessonById.set(lessonId, row);
  }

  const campuses = new Map<string, CampusBuild>();
  const campusNameByJwId = new Map<number, string>();
  const buildings = new Map<number, BuildingBuild>();
  const rooms = new Map<number, RoomBuild>();
  const roomTypes = new Map<number, RoomTypeBuild>();
  const adminClasses: AdminClassOccurrence[] = [];

  function addCampus(campus: CampusBuild) {
    if (campus.jwId != null) {
      const existingName = campusNameByJwId.get(campus.jwId);
      if (existingName != null && existingName !== campus.nameCn) {
        throw new Error(
          `Campus jwId ${campus.jwId} has conflicting names: ${existingName} vs ${campus.nameCn}`,
        );
      }
      campusNameByJwId.set(campus.jwId, campus.nameCn);
    }

    const existing = campuses.get(campus.nameCn);
    if (existing == null) {
      campuses.set(campus.nameCn, campus);
      return;
    }
    if (campus.jwId != null) {
      existing.jwId =
        existing.jwId == null
          ? campus.jwId
          : Math.min(existing.jwId, campus.jwId);
    }
    existing.nameEn ??= campus.nameEn;
    existing.code ??= campus.code;
  }

  for (const row of roomRows) {
    const parentId = asInt(row.store_id);
    if (parentId == null) continue;
    const building = firstChild(buildingRows, parentId);
    const roomType = firstChild(roomTypeRows, parentId);
    const room = mapRoom(row, building, roomType);
    if (room == null || rooms.has(room.jwId)) continue;
    rooms.set(room.jwId, room);

    if (building) {
      const campus = firstChild(campusRows, asInt(building.store_id) ?? -1);
      if (campus) {
        const c = mapCampus(campus);
        if (c != null) {
          addCampus(c);
        }
      }
      const b = mapBuilding(building, campus);
      if (b != null && !buildings.has(b.jwId)) buildings.set(b.jwId, b);
    }

    if (roomType) {
      const rt = mapRoomType(roomType);
      if (rt != null && !roomTypes.has(rt.jwId)) roomTypes.set(rt.jwId, rt);
    }
  }

  for (const lesson of catalogLessonRows) {
    const lessonId = asInt(lesson.id);
    const parentId = asInt(lesson.store_id);
    if (lessonId == null || parentId == null) continue;
    const campus = mapCampusFromSection(
      scheduleLessonById.get(lessonId),
      firstChild(catalogCampusRows, parentId),
    );
    if (campus != null) addCampus(campus);
  }

  for (const row of adminClassRows) {
    const ac = mapAdminClass(row);
    const semesterCode = asInt(row.semester_id);
    if (ac == null || semesterCode == null) continue;
    adminClasses.push({ semesterCode, adminClass: ac });
  }

  return {
    campuses: Array.from(campuses.values()),
    campusNameByJwId,
    roomTypes: Array.from(roomTypes.values()),
    buildings: Array.from(buildings.values()),
    rooms: Array.from(rooms.values()),
    adminClasses,
  };
}

function loadSections(
  snapshot: Snapshot,
  minSemester: number,
  courseSourceKeyByParentId: Map<number, string>,
  sectionTeacherIdentities: Map<string, TeacherIdentityReference>,
  onSection: (jwId: number) => void,
  sectionTeacherPairs: SectionTeacherPair[],
): {
  sections: SectionBuild[];
  placeholderDepartments: DepartmentPlaceholderRequest[];
} {
  const lessons = snapshot.queryAll("catalog_teach_lesson_list_for_teach");
  const scheduleLessonRows = snapshot.queryAll(
    "jw_ws_schedule_table_datum_result_lessonList",
  );
  const scheduleLessonMap = new Map<number, SnapshotRow>();
  for (const row of scheduleLessonRows) {
    const id = asInt(row.id);
    if (id != null) scheduleLessonMap.set(id, row);
  }

  const requiredInfoMap = snapshot.queryGrouped(
    "jw_ws_schedule_table_datum_result_lessonList_requiredPeriodInfo",
  );
  const suggestWeeksMap = snapshot.queryGrouped(
    "jw_ws_schedule_table_datum_result_lessonList_suggestScheduleWeeks",
  );
  const jsonParamsMap = snapshot.queryGrouped(
    "jw_ws_schedule_table_datum_result_lessonList_scheduleJsonParams",
  );

  const courses = snapshot.queryGrouped(
    "catalog_teach_lesson_list_for_teach_course",
  );
  const openDepartments = snapshot.queryGrouped(
    "catalog_teach_lesson_list_for_teach_openDepartment",
  );
  const campuses = snapshot.queryGrouped(
    "catalog_teach_lesson_list_for_teach_campus",
  );
  const examModes = snapshot.queryGrouped(
    "catalog_teach_lesson_list_for_teach_examMode",
  );
  const teachLanguages = snapshot.queryGrouped(
    "catalog_teach_lesson_list_for_teach_teachLang",
  );
  const dtpptMap = snapshot.queryGrouped(
    "catalog_teach_lesson_list_for_teach_dateTimePlacePersonText",
  );
  const catalogAssignments = snapshot.queryGrouped(
    "catalog_teach_lesson_list_for_teach_teacherAssignmentList",
  );

  const placeholderDepartments: DepartmentPlaceholderRequest[] = [];
  const seenPlaceholders = new Set<string>();
  function requestPlaceholder(code: string | undefined, nameCn: string) {
    const placeholderCode = code ?? stablePlaceholderCode(nameCn);
    if (seenPlaceholders.has(placeholderCode)) return;
    seenPlaceholders.add(placeholderCode);
    placeholderDepartments.push({ code: placeholderCode, nameCn });
  }

  const sections: SectionBuild[] = [];

  for (const lesson of lessons) {
    const semesterCode = asInt(lesson.semester_id);
    if (semesterCode == null || semesterCode < minSemester) continue;

    const parentId = asInt(lesson.store_id);
    if (parentId == null) continue;

    const courseRow = firstChild(courses, parentId);
    const courseSourceKey = requireCourseSourceKey(
      courseSourceKeyByParentId,
      parentId,
    );
    const openDeptRow = firstChild(openDepartments, parentId);
    const scheduleLesson = scheduleLessonMap.get(asInt(lesson.id) ?? -1);
    const scheduleStoreId = asInt(scheduleLesson?.store_id);
    const section = mapSection(
      lesson,
      scheduleLesson,
      scheduleStoreId == null
        ? undefined
        : firstChild(requiredInfoMap, scheduleStoreId),
      scheduleStoreId == null
        ? undefined
        : suggestWeeksMap.get(scheduleStoreId),
      scheduleStoreId == null ? undefined : jsonParamsMap.get(scheduleStoreId),
      dtpptMap.get(parentId),
      {
        course: courseRow,
        courseSourceKey,
        examMode: firstChild(examModes, parentId),
        openDepartment: openDeptRow,
        teachLanguage: firstChild(teachLanguages, parentId),
        campus: firstChild(campuses, parentId),
      },
    );
    if (section == null) continue;

    sections.push(section);
    onSection(section.jwId);

    if (section.openDepartmentCode) {
      requestPlaceholder(
        section.openDepartmentCode,
        asString(openDeptRow?.cn) ?? section.openDepartmentCode,
      );
    }

    for (const assignment of catalogAssignments.get(parentId) ?? []) {
      const nameCn = asString(assignment.cn) ?? "";
      const identity = sectionTeacherIdentities.get(
        sectionTeacherNameKey(section.jwId, nameCn),
      );
      sectionTeacherPairs.push({
        ...(identity ?? {}),
        sectionJwId: section.jwId,
        nameCn,
        departmentCode: asString(assignment.departmentCode),
      });
    }
  }

  return { sections, placeholderDepartments };
}

function loadScheduleData(
  snapshot: Snapshot,
  importedSectionJwIds: Set<number>,
  teacherAssignments: TeacherAssignmentBuild[],
  adminClassSectionPairs: AdminClassSectionPair[],
): {
  scheduleGroups: ScheduleGroupBuild[];
  schedules: ScheduleBuild[];
  scheduleInfrastructureTeacherPairs: SectionTeacherPair[];
} {
  const scheduleGroupRows = snapshot.queryAll(
    "jw_ws_schedule_table_datum_result_scheduleGroupList",
  );
  const scheduleListRows = snapshot.queryAll(
    "jw_ws_schedule_table_datum_result_scheduleList",
  );
  const roomMap = snapshot.queryGrouped(
    "jw_ws_schedule_table_datum_result_scheduleList_room",
  );

  const scheduleLessonRows = snapshot.queryAll(
    "jw_ws_schedule_table_datum_result_lessonList",
  );
  const assignmentRows = snapshot.queryGrouped(
    "jw_ws_schedule_table_datum_result_lessonList_teacherAssignmentList",
  );
  const teacherLessonTypeRows = snapshot.queryGrouped(
    "jw_ws_schedule_table_datum_result_lessonList_teacherAssignmentList_teacherLessonType",
  );
  const weekIndicesRows = snapshot.queryGrouped(
    "jw_ws_schedule_table_datum_result_lessonList_teacherAssignmentList_weekIndices",
  );
  const adminClassRows = snapshot.queryGrouped(
    "jw_ws_schedule_table_datum_result_lessonList_adminclasses",
  );

  const scheduleInfrastructureTeacherPairs: SectionTeacherPair[] = [];

  const scheduleGroups: ScheduleGroupBuild[] = [];
  const seenGroups = new Set<number>();
  for (const row of scheduleGroupRows) {
    const group = mapScheduleGroup(row);
    if (group == null || !importedSectionJwIds.has(group.lessonJwId)) continue;
    if (seenGroups.has(group.jwId)) continue;
    seenGroups.add(group.jwId);
    scheduleGroups.push(group);
  }

  const schedules = new Map<string, ScheduleBuild>();
  for (const row of scheduleListRows) {
    const lessonJwId = asInt(row.lessonId);
    if (lessonJwId == null || !importedSectionJwIds.has(lessonJwId)) continue;
    const room = firstChild(roomMap, asInt(row.store_id) ?? -1);
    const roomJwId = asInt(room?.id) ?? asInt(row.roomId);
    const key = scheduleKey(row, roomJwId);
    const personId = asInt(row.personId);
    const existing = schedules.get(key);
    if (existing) {
      mergeSchedule(existing, row, personId ?? undefined, roomJwId);
      continue;
    }

    const schedule = mapSchedule(row, personId ?? undefined, roomJwId);
    schedules.set(key, schedule);
  }

  for (const lesson of scheduleLessonRows) {
    const lessonId = asInt(lesson.id);
    if (lessonId == null || !importedSectionJwIds.has(lessonId)) continue;
    const parentId = asInt(lesson.store_id);
    if (parentId == null) continue;

    for (const assignment of assignmentRows.get(parentId) ?? []) {
      const personId = asInt(assignment.personId);
      if (personId != null) {
        scheduleInfrastructureTeacherPairs.push({
          sectionJwId: lessonId,
          personId,
          nameCn: asString(assignment.name) ?? "",
        });
      }

      const teacherLessonType = firstChild(
        teacherLessonTypeRows,
        asInt(assignment.store_id) ?? -1,
      );
      const weekIndices =
        weekIndicesRows.get(asInt(assignment.store_id) ?? -1) ?? [];

      const teacherLessonTypeId = asInt(teacherLessonType?.id);

      const ta = mapTeacherAssignment(
        lessonId,
        assignment,
        weekIndices,
        teacherLessonTypeId ?? undefined,
      );
      if (ta == null) continue;
      teacherAssignments.push(ta);
    }

    for (const ac of adminClassRows.get(parentId) ?? []) {
      const adminClassJwId = asInt(ac.id);
      if (adminClassJwId == null) continue;
      adminClassSectionPairs.push({ adminClassJwId, sectionJwId: lessonId });
    }
  }

  return {
    scheduleGroups,
    schedules: Array.from(schedules.values()),
    scheduleInfrastructureTeacherPairs,
  };
}

function loadExams(
  snapshot: Snapshot,
  importedSectionJwIds: Set<number>,
): ExamBuild[] {
  const examRows = snapshot.queryAll("catalog_teach_exam_list");
  const lessonMap = snapshot.queryGrouped("catalog_teach_exam_list_lesson");
  const batchMap = snapshot.queryGrouped("catalog_teach_exam_list_examBatch");
  const roomsMap = snapshot.queryGrouped("catalog_teach_exam_list_examRooms");

  const result: ExamBuild[] = [];
  for (const row of examRows) {
    const parentId = asInt(row.store_id);
    if (parentId == null) continue;
    const lesson = firstChild(lessonMap, parentId);
    const sectionJwId = asInt(lesson?.id);
    if (sectionJwId == null || !importedSectionJwIds.has(sectionJwId)) continue;

    const exam = mapExam(
      row,
      lesson,
      firstChild(batchMap, parentId),
      roomsMap.get(parentId) ?? [],
    );
    if (exam == null) continue;
    result.push(exam);
  }
  return result;
}

async function upsertSemesters(
  tx: Prisma.TransactionClient,
  builds: SemesterBuild[],
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  for (const build of builds) {
    const result = await tx.semester.upsert({
      where: { jwId: build.jwId },
      create: {
        jwId: build.jwId,
        nameCn: build.nameCn,
        code: build.code,
        startDate: build.start,
        endDate: build.end,
      },
      update: {
        nameCn: build.nameCn,
        code: build.code,
        startDate: build.start,
        endDate: build.end,
      },
    });
    map.set(build.jwId, result.id);
  }
  return map;
}

async function upsertDepartments(
  tx: Prisma.TransactionClient,
  builds: DepartmentBuild[],
  placeholders: DepartmentPlaceholderRequest[],
): Promise<Map<string, number>> {
  for (const build of builds) {
    await tx.department.upsert({
      where: { code: build.code },
      create: {
        code: build.code,
        nameCn: build.nameCn,
        nameEn: build.nameEn,
        isCollege: build.isCollege,
      },
      update: {
        nameCn: build.nameCn,
        nameEn: build.nameEn,
        isCollege: build.isCollege,
      },
    });
  }

  if (placeholders.length > 0) {
    await tx.department.createMany({
      data: placeholders.map((p) => ({
        code: p.code,
        nameCn: p.nameCn,
        isCollege: false,
      })),
      skipDuplicates: true,
    });
  }

  const rows = await tx.department.findMany({
    select: { id: true, code: true },
  });
  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.code) map.set(row.code, row.id);
  }
  return map;
}

type LookupMaps = {
  courseCategory: Map<string, number>;
  courseClassify: Map<string, number>;
  courseGradation: Map<string, number>;
  courseType: Map<string, number>;
  educationLevel: Map<string, number>;
  classType: Map<string, number>;
  examMode: Map<string, number>;
  teachLanguage: Map<string, number>;
};

async function loadLookupTables(
  tx: Prisma.TransactionClient,
  lookups: {
    courseCategories: { nameCn: string; nameEn?: string }[];
    courseClassifies: { nameCn: string; nameEn?: string }[];
    courseGradations: { nameCn: string; nameEn?: string }[];
    courseTypes: { nameCn: string; nameEn?: string }[];
    educationLevels: { nameCn: string; nameEn?: string }[];
    classTypes: { nameCn: string; nameEn?: string }[];
    examModes: { nameCn: string; nameEn?: string }[];
    teachLanguages: { nameCn: string; nameEn?: string }[];
  },
): Promise<LookupMaps> {
  async function loadModel(
    model:
      | "courseCategory"
      | "courseClassify"
      | "courseGradation"
      | "courseType"
      | "educationLevel"
      | "classType"
      | "examMode"
      | "teachLanguage",
    items: { nameCn: string; nameEn?: string }[],
  ) {
    if (items.length === 0) return new Map<string, number>();
    const data = items.map((i) => ({ nameCn: i.nameCn, nameEn: i.nameEn }));
    await tx[model].createMany({ data, skipDuplicates: true });
    // @ts-expect-error dynamic model access not statically typed
    const rows = await tx[model].findMany({
      select: { id: true, nameCn: true },
    });
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.nameCn, row.id);
    }
    return map;
  }

  return {
    courseCategory: await loadModel("courseCategory", lookups.courseCategories),
    courseClassify: await loadModel("courseClassify", lookups.courseClassifies),
    courseGradation: await loadModel(
      "courseGradation",
      lookups.courseGradations,
    ),
    courseType: await loadModel("courseType", lookups.courseTypes),
    educationLevel: await loadModel("educationLevel", lookups.educationLevels),
    classType: await loadModel("classType", lookups.classTypes),
    examMode: await loadModel("examMode", lookups.examModes),
    teachLanguage: await loadModel("teachLanguage", lookups.teachLanguages),
  };
}

async function upsertCourses(
  tx: Prisma.TransactionClient,
  builds: CourseBuild[],
  lookupMaps: LookupMaps,
): Promise<{
  map: Map<string, number>;
  incomingCourses: IncomingCourseIdentityRecord[];
  canonicalJwIds: ReadonlySet<number>;
}> {
  const columns = [
    "code",
    "nameCn",
    "nameEn",
    "categoryId",
    "classTypeId",
    "classifyId",
    "educationLevelId",
    "gradationId",
    "typeId",
  ];
  const incomingCourses: IncomingCourseIdentityRecord[] = builds.map(
    (build) => ({
      sourceKey: build.sourceKey,
      jwId: build.jwId,
      code: build.code,
      nameCn: build.nameCn,
      nameEn: build.nameEn,
      categoryId: build.categoryName
        ? lookupMaps.courseCategory.get(build.categoryName)
        : null,
      classTypeId: build.classTypeName
        ? lookupMaps.classType.get(build.classTypeName)
        : null,
      classifyId: build.classifyName
        ? lookupMaps.courseClassify.get(build.classifyName)
        : null,
      educationLevelId: build.educationLevelName
        ? lookupMaps.educationLevel.get(build.educationLevelName)
        : null,
      gradationId: build.gradationName
        ? lookupMaps.courseGradation.get(build.gradationName)
        : null,
      typeId: build.typeName ? lookupMaps.courseType.get(build.typeName) : null,
    }),
  );

  // Validate required identity fields before querying or writing any courses.
  for (const course of incomingCourses) courseIdentitySignature(course);
  if (incomingCourses.length === 0) {
    return {
      map: new Map(),
      incomingCourses,
      canonicalJwIds: new Set(),
    };
  }

  const select = {
    jwId: true,
    code: true,
    nameCn: true,
    nameEn: true,
    categoryId: true,
    classTypeId: true,
    classifyId: true,
    educationLevelId: true,
    gradationId: true,
    typeId: true,
  } as const;
  // The catalog is small enough to compare against every persisted Course.
  // The full set is also required to detect synthetic jwId collisions.
  const persistedCourses = await tx.course.findMany({ select });
  const plan = await planCourseIdentityImport(
    incomingCourses,
    persistedCourses,
  );
  await assertCourseJwIdNamespace(
    tx,
    plan.canonicalCourses.map((course) => course.jwId),
  );
  const records = plan.canonicalCourses.map((course) => ({
    key: course.jwId,
    values: [
      course.code,
      course.nameCn,
      course.nameEn,
      course.categoryId,
      course.classTypeId,
      course.classifyId,
      course.educationLevelId,
      course.gradationId,
      course.typeId,
    ] satisfies ColumnValue[],
  }));
  const canonicalMap = await bulkUpsert(
    tx,
    "Course",
    "jwId",
    "int",
    columns,
    ["text", "text", "text", "int", "int", "int", "int", "int", "int"],
    records,
  );
  const map = new Map<string, number>();
  for (const [sourceKey, canonicalJwId] of plan.canonicalJwIdBySourceKey) {
    const databaseId = canonicalMap.get(canonicalJwId);
    if (databaseId == null) {
      throw new Error(
        `Course identity plan did not resolve source key ${sourceKey}`,
      );
    }
    map.set(sourceKey, databaseId);
  }
  return {
    map,
    incomingCourses,
    canonicalJwIds: new Set(plan.canonicalCourses.map((course) => course.jwId)),
  };
}

async function upsertTeacherTitles(
  tx: Prisma.TransactionClient,
  builds: TeacherTitleBuild[],
): Promise<Map<number, number>> {
  const canonicalByName = new Map<string, TeacherTitleBuild>();
  const aliasToCanonical = new Map<number, number>();
  for (const build of builds) {
    const canonical = canonicalByName.get(build.nameCn);
    if (canonical == null) {
      canonicalByName.set(build.nameCn, build);
    }
    aliasToCanonical.set(build.jwId, canonical?.jwId ?? build.jwId);
  }

  const canonicalMap = new Map<number, number>();
  for (const build of canonicalByName.values()) {
    const result = await tx.teacherTitle.upsert({
      where: { nameCn: build.nameCn },
      create: {
        jwId: build.jwId,
        nameCn: build.nameCn,
        nameEn: build.nameEn,
        code: build.code,
        enabled: build.enabled,
      },
      update: {
        jwId: build.jwId,
        nameEn: build.nameEn,
        code: build.code,
        enabled: build.enabled,
      },
    });
    canonicalMap.set(build.jwId, result.id);
  }

  const map = new Map<number, number>();
  for (const [jwId, canonicalJwId] of aliasToCanonical) {
    const dbId = canonicalMap.get(canonicalJwId);
    if (dbId != null) {
      map.set(jwId, dbId);
    }
  }
  return map;
}

async function upsertTeacherLessonTypes(
  tx: Prisma.TransactionClient,
  builds: TeacherLessonTypeBuild[],
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  for (const build of builds) {
    const result = await tx.teacherLessonType.upsert({
      where: { jwId: build.jwId },
      create: {
        jwId: build.jwId,
        nameCn: build.nameCn,
        nameEn: build.nameEn,
        code: build.code,
        role: build.role,
        enabled: build.enabled,
      },
      update: {
        nameCn: build.nameCn,
        nameEn: build.nameEn,
        code: build.code,
        role: build.role,
        enabled: build.enabled,
      },
    });
    map.set(build.jwId, result.id);
  }
  return map;
}

async function upsertExamBatches(
  tx: Prisma.TransactionClient,
  builds: ExamBatchBuild[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  for (const build of builds) {
    const result = await tx.examBatch.upsert({
      where: { nameCn: build.nameCn },
      create: { nameCn: build.nameCn },
      update: {},
    });
    map.set(build.nameCn, result.id);
  }
  return map;
}

async function upsertTeachers(
  tx: Prisma.TransactionClient,
  builds: TeacherBuild[],
  departmentMap: Map<string, number>,
  teacherTitleMap: Map<number, number>,
): Promise<TeacherMap> {
  const map: TeacherMap = {
    byPersonId: new Map(),
    byTeacherId: new Map(),
    byCode: new Map(),
    byNameDept: new Map(),
  };

  const unknownDepartmentId = departmentMap.get(UNKNOWN_DEPARTMENT_CODE);

  const columns = [
    "personId",
    "teacherId",
    "code",
    "nameCn",
    "nameEn",
    "age",
    "email",
    "telephone",
    "mobile",
    "address",
    "postcode",
    "qq",
    "wechat",
    "departmentId",
    "teacherTitleId",
  ];

  const resolved = builds.map((build) => {
    let departmentId = build.departmentCode
      ? departmentMap.get(build.departmentCode)
      : undefined;
    if (departmentId == null) {
      departmentId = unknownDepartmentId;
    }
    return {
      build,
      departmentId,
      values: [
        build.personId ?? null,
        build.teacherId ?? null,
        build.code ?? null,
        build.nameCn,
        build.nameEn ?? null,
        build.age ?? null,
        build.email ?? null,
        build.telephone ?? null,
        build.mobile ?? null,
        build.address ?? null,
        build.postcode ?? null,
        build.qq ?? null,
        build.wechat ?? null,
        departmentId ?? null,
        build.teacherTitleId ? teacherTitleMap.get(build.teacherTitleId) : null,
      ] satisfies ColumnValue[],
    };
  });

  const existing = await tx.teacher.findMany({
    select: {
      id: true,
      personId: true,
      teacherId: true,
      code: true,
      nameCn: true,
      departmentId: true,
    },
  });

  const existingByPersonId = new Map<number, number>();
  const existingByTeacherId = new Map<number, number>();
  const existingByCode = new Map<string, number>();
  const existingFallbackByNameDept = new Map<string, number>();
  for (const t of existing) {
    if (t.personId != null) existingByPersonId.set(t.personId, t.id);
    if (t.teacherId != null) existingByTeacherId.set(t.teacherId, t.id);
    if (t.code != null && t.code !== "") existingByCode.set(t.code, t.id);
    if (
      t.personId == null &&
      t.teacherId == null &&
      (t.code == null || t.code === "") &&
      t.departmentId != null
    ) {
      existingFallbackByNameDept.set(`${t.nameCn}:${t.departmentId}`, t.id);
    }
  }

  const toInsert: Array<{
    build: TeacherBuild;
    values: ColumnValue[];
  }> = [];
  const toUpdate: Array<{ id: number; values: ColumnValue[] }> = [];

  for (const { build, values } of resolved) {
    let existingId: number | undefined;
    if (build.personId != null) {
      existingId = existingByPersonId.get(build.personId);
    } else if (build.teacherId != null) {
      existingId = existingByTeacherId.get(build.teacherId);
    } else if (build.code != null && build.code !== "") {
      existingId = existingByCode.get(build.code);
    } else {
      const departmentId = values[13] as number | null;
      if (departmentId != null) {
        existingId = existingFallbackByNameDept.get(
          `${build.nameCn}:${departmentId}`,
        );
      }
    }

    if (existingId != null) {
      toUpdate.push({ id: existingId, values });
    } else {
      toInsert.push({ build, values });
    }
  }

  if (toInsert.length > 0) {
    const insertData = toInsert.map(({ build, values }) => ({
      personId: values[0] as number | null,
      teacherId: values[1] as number | null,
      code: values[2] as string | null,
      nameCn: values[3] as string,
      nameEn: values[4] as string | null,
      age: values[5] as number | null,
      email: values[6] as string | null,
      telephone: values[7] as string | null,
      mobile: values[8] as string | null,
      address: values[9] as string | null,
      postcode: values[10] as string | null,
      qq: values[11] as string | null,
      wechat: values[12] as string | null,
      departmentId: values[13] as number | null,
      teacherTitleId: values[14] as number | null,
    }));
    await tx.teacher.createMany({ data: insertData, skipDuplicates: true });
  }

  await bulkUpdate(
    tx,
    "Teacher",
    columns,
    [
      "int",
      "int",
      "text",
      "text",
      "text",
      "int",
      "text",
      "text",
      "text",
      "text",
      "text",
      "text",
      "text",
      "int",
      "int",
    ],
    toUpdate,
  );

  const allTeachers = await tx.teacher.findMany({
    select: {
      id: true,
      personId: true,
      teacherId: true,
      code: true,
      nameCn: true,
      departmentId: true,
    },
  });

  const departmentIdToCode = new Map<number, string>();
  for (const [code, id] of departmentMap) {
    departmentIdToCode.set(id, code);
  }

  const allFallbackTeachersByNameDept = new Map<string, number>();
  for (const t of allTeachers) {
    if (t.personId != null) map.byPersonId.set(t.personId, t.id);
    if (t.teacherId != null) map.byTeacherId.set(t.teacherId, t.id);
    if (t.code != null && t.code !== "") map.byCode.set(t.code, t.id);
    if (
      t.personId == null &&
      t.teacherId == null &&
      (t.code == null || t.code === "") &&
      t.departmentId != null
    ) {
      const code =
        departmentIdToCode.get(t.departmentId) ?? UNKNOWN_DEPARTMENT_CODE;
      allFallbackTeachersByNameDept.set(`${t.nameCn}:${code}`, t.id);
    }
  }

  for (const { build } of resolved) {
    const deptKey = build.departmentCode ?? UNKNOWN_DEPARTMENT_CODE;
    let teacherId: number | undefined;
    if (build.personId != null) {
      teacherId = map.byPersonId.get(build.personId);
    } else if (build.teacherId != null) {
      teacherId = map.byTeacherId.get(build.teacherId);
    } else if (build.code != null && build.code !== "") {
      teacherId = map.byCode.get(build.code);
    } else {
      teacherId = allFallbackTeachersByNameDept.get(
        `${build.nameCn}:${deptKey}`,
      );
    }
    if (
      teacherId != null &&
      build.personId == null &&
      build.teacherId == null &&
      (build.code == null || build.code === "")
    ) {
      map.byNameDept.set(`${build.nameCn}:${deptKey}`, teacherId);
    }
  }

  return map;
}

type TeacherMap = {
  byPersonId: Map<number, number>;
  byTeacherId: Map<number, number>;
  byCode: Map<string, number>;
  byNameDept: Map<string, number>;
};

function resolveTeacherId(
  build: TeacherAssignmentBuild | SectionTeacherPair,
  map: TeacherMap,
): number | undefined {
  const identityId = resolveTeacherIdentityId(build, map);
  if (identityId != null) return identityId;
  const deptKey = `${build.nameCn}:${build.departmentCode ?? UNKNOWN_DEPARTMENT_CODE}`;
  return map.byNameDept.get(deptKey);
}

function resolveTeacherIdentityId(
  identity: TeacherIdentityReference,
  map: TeacherMap,
): number | undefined {
  if (identity.personId != null) {
    const id = map.byPersonId.get(identity.personId);
    if (id != null) return id;
  }
  if (identity.teacherId != null) {
    const id = map.byTeacherId.get(identity.teacherId);
    if (id != null) return id;
  }
  if (identity.code != null && identity.code !== "") {
    const id = map.byCode.get(identity.code);
    if (id != null) return id;
  }
  return undefined;
}

function requireConsistentTeacherIdentityId(
  identity: TeacherIdentityReference,
  map: TeacherMap,
): number | undefined {
  const ids = new Set<number>();
  if (identity.personId != null) {
    const id = map.byPersonId.get(identity.personId);
    if (id != null) ids.add(id);
  }
  if (identity.teacherId != null) {
    const id = map.byTeacherId.get(identity.teacherId);
    if (id != null) ids.add(id);
  }
  if (identity.code != null && identity.code !== "") {
    const id = map.byCode.get(identity.code);
    if (id != null) ids.add(id);
  }
  if (ids.size > 1) {
    throw new Error(
      "Teacher identity tuple resolved to multiple database rows",
    );
  }
  return [...ids][0];
}

async function upsertCampuses(
  tx: Prisma.TransactionClient,
  builds: CampusBuild[],
  campusNameByJwId: Map<number, string>,
): Promise<CampusMap> {
  const map: CampusMap = {
    byJwId: new Map<number, number>(),
    byName: new Map<string, number>(),
  };

  for (const build of builds) {
    const result = await tx.campus.upsert({
      where: { nameCn: build.nameCn },
      create: {
        jwId: build.jwId,
        nameCn: build.nameCn,
        nameEn: build.nameEn,
        code: build.code,
      },
      update: {
        jwId: build.jwId,
        nameEn: build.nameEn,
        code: build.code,
      },
    });
    map.byName.set(build.nameCn, result.id);
  }

  for (const [jwId, nameCn] of campusNameByJwId) {
    const campusId = map.byName.get(nameCn);
    if (campusId == null) {
      throw new Error(`Campus ${nameCn} for jwId ${jwId} was not upserted`);
    }
    map.byJwId.set(jwId, campusId);
  }

  return map;
}

type CampusMap = {
  byJwId: Map<number, number>;
  byName: Map<string, number>;
};

async function upsertRoomTypes(
  tx: Prisma.TransactionClient,
  builds: RoomTypeBuild[],
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  for (const build of builds) {
    const result = await tx.roomType.upsert({
      where: { jwId: build.jwId },
      create: {
        jwId: build.jwId,
        nameCn: build.nameCn,
        nameEn: build.nameEn,
        code: build.code,
      },
      update: {
        nameCn: build.nameCn,
        nameEn: build.nameEn,
        code: build.code,
      },
    });
    map.set(build.jwId, result.id);
  }
  return map;
}

async function upsertBuildings(
  tx: Prisma.TransactionClient,
  builds: BuildingBuild[],
  campusMap: Map<number, number>,
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  for (const build of builds) {
    const result = await tx.building.upsert({
      where: { jwId: build.jwId },
      create: {
        jwId: build.jwId,
        nameCn: build.nameCn,
        nameEn: build.nameEn,
        code: build.code,
        campusId: build.campusJwId
          ? campusMap.get(build.campusJwId)
          : undefined,
      },
      update: {
        nameCn: build.nameCn,
        nameEn: build.nameEn,
        code: build.code,
        campusId: build.campusJwId
          ? campusMap.get(build.campusJwId)
          : undefined,
      },
    });
    map.set(build.jwId, result.id);
  }
  return map;
}

async function upsertRooms(
  tx: Prisma.TransactionClient,
  builds: RoomBuild[],
  buildingMap: Map<number, number>,
  roomTypeMap: Map<number, number>,
): Promise<Map<number, number>> {
  const columns = [
    "nameCn",
    "nameEn",
    "code",
    "floor",
    "virtual",
    "seatsForSection",
    "remark",
    "seats",
    "buildingId",
    "roomTypeId",
  ];
  const records = builds.map((build) => ({
    key: build.jwId,
    values: [
      build.nameCn,
      build.nameEn,
      build.code,
      build.floor,
      build.virtual,
      build.seatsForSection,
      build.remark,
      build.seats,
      build.buildingJwId ? buildingMap.get(build.buildingJwId) : null,
      build.roomTypeJwId ? roomTypeMap.get(build.roomTypeJwId) : null,
    ] satisfies ColumnValue[],
  }));
  return bulkUpsert(
    tx,
    "Room",
    "jwId",
    "int",
    columns,
    [
      "text",
      "text",
      "text",
      "int",
      "boolean",
      "int",
      "text",
      "int",
      "int",
      "int",
    ],
    records,
  );
}

async function upsertAdminClasses(
  tx: Prisma.TransactionClient,
  builds: AdminClassOccurrence[],
): Promise<Map<number, number>> {
  const { canonicalBuilds, canonicalJwIdByAlias } =
    canonicalizeAdminClasses(builds);
  const columns = [
    "jwId",
    "code",
    "grade",
    "nameEn",
    "stdCount",
    "planCount",
    "enabled",
    "abbrZh",
    "abbrEn",
  ];
  const records = canonicalBuilds.map((build) => ({
    key: build.nameCn,
    values: [
      build.jwId,
      build.code,
      build.grade,
      build.nameEn,
      build.stdCount,
      build.planCount,
      build.enabled,
      build.abbrZh,
      build.abbrEn,
    ] satisfies ColumnValue[],
  }));
  const nameToId = await bulkUpsert(
    tx,
    "AdminClass",
    "nameCn",
    "text",
    columns,
    ["int", "text", "text", "text", "int", "int", "boolean", "text", "text"],
    records,
  );
  const map = new Map<number, number>();
  const canonicalNameByJwId = new Map(
    canonicalBuilds.map((build) => [build.jwId, build.nameCn]),
  );
  for (const [aliasJwId, canonicalJwId] of canonicalJwIdByAlias) {
    const canonicalName = canonicalNameByJwId.get(canonicalJwId);
    const id = canonicalName == null ? undefined : nameToId.get(canonicalName);
    if (id != null) map.set(aliasJwId, id);
  }
  return map;
}

async function upsertSections(
  tx: Prisma.TransactionClient,
  builds: SectionBuild[],
  semesterMap: Map<number, number>,
  departmentMap: Map<string, number>,
  courseMap: Map<string, number>,
  lookupMaps: LookupMaps,
  campusMap: CampusMap,
  roomTypeMap: Map<number, number>,
): Promise<Map<number, number>> {
  const columns = [
    "code",
    "bizTypeId",
    "credits",
    "period",
    "periodsPerWeek",
    "timesPerWeek",
    "stdCount",
    "limitCount",
    "graduateAndPostgraduate",
    "dateTimePlaceText",
    "dateTimePlacePersonText",
    "actualPeriods",
    "theoryPeriods",
    "practicePeriods",
    "experimentPeriods",
    "machinePeriods",
    "designPeriods",
    "testPeriods",
    "scheduleState",
    "suggestScheduleWeeks",
    "suggestScheduleWeekInfo",
    "scheduleJsonParams",
    "selectedStdCount",
    "remark",
    "scheduleRemark",
    "courseId",
    "semesterId",
    "campusId",
    "examModeId",
    "openDepartmentId",
    "teachLanguageId",
    "roomTypeId",
  ];
  const records: Array<{ key: number; values: ColumnValue[] }> = [];
  for (const build of builds) {
    const courseId = requireCourseDatabaseId(
      courseMap,
      build.courseSourceKey,
      build.jwId,
    );
    const semesterId = semesterMap.get(build.semesterCode);
    if (semesterId == null) continue;
    const openDepartmentId = build.openDepartmentCode
      ? departmentMap.get(build.openDepartmentCode)
      : null;
    const campusId =
      (build.campusId != null
        ? campusMap.byJwId.get(build.campusId)
        : undefined) ??
      (build.campusName != null
        ? campusMap.byName.get(build.campusName)
        : undefined);
    if (
      campusId == null &&
      (build.campusId != null || build.campusName != null)
    ) {
      throw new Error(
        `Campus did not resolve for section jwId ${build.jwId}: ${build.campusId ?? build.campusName}`,
      );
    }
    records.push({
      key: build.jwId,
      values: [
        build.code,
        build.bizTypeId,
        build.credits,
        build.period,
        build.periodsPerWeek != null ? Math.round(build.periodsPerWeek) : null,
        build.timesPerWeek,
        build.stdCount,
        build.limitCount,
        build.graduateAndPostgraduate,
        build.dateTimePlaceText,
        build.dateTimePlacePersonText != null
          ? JSON.stringify(build.dateTimePlacePersonText)
          : null,
        build.actualPeriods != null ? Math.round(build.actualPeriods) : null,
        build.theoryPeriods,
        build.practicePeriods,
        build.experimentPeriods,
        build.machinePeriods,
        build.designPeriods,
        build.testPeriods,
        build.scheduleState,
        build.suggestScheduleWeeks != null
          ? JSON.stringify(build.suggestScheduleWeeks)
          : null,
        build.suggestScheduleWeekInfo,
        build.scheduleJsonParams != null
          ? JSON.stringify(build.scheduleJsonParams)
          : null,
        build.selectedStdCount,
        build.remark,
        build.scheduleRemark,
        courseId,
        semesterId,
        campusId,
        build.examModeName ? lookupMaps.examMode.get(build.examModeName) : null,
        openDepartmentId,
        build.teachLanguageName
          ? lookupMaps.teachLanguage.get(build.teachLanguageName)
          : null,
        build.roomTypeId != null ? roomTypeMap.get(build.roomTypeId) : null,
      ],
    });
  }
  return bulkUpsert(
    tx,
    "Section",
    "jwId",
    "int",
    columns,
    [
      "text",
      "int",
      "float8",
      "int",
      "int",
      "int",
      "int",
      "int",
      "boolean",
      "text",
      "jsonb",
      "int",
      "float8",
      "float8",
      "float8",
      "float8",
      "float8",
      "float8",
      "text",
      "jsonb",
      "text",
      "jsonb",
      "int",
      "text",
      "text",
      "int",
      "int",
      "int",
      "int",
      "int",
      "int",
      "int",
    ],
    records,
    { updateColumns: sectionConflictUpdateColumns(columns) },
  );
}

async function upsertScheduleGroups(
  tx: Prisma.TransactionClient,
  builds: ScheduleGroupBuild[],
  sectionMap: Map<number, number>,
): Promise<Map<number, number>> {
  const columns = [
    "no",
    "limitCount",
    "stdCount",
    "actualPeriods",
    "isDefault",
    "sectionId",
  ];
  const records: Array<{ key: number; values: ColumnValue[] }> = [];
  for (const build of builds) {
    const sectionId = sectionMap.get(build.lessonJwId);
    if (sectionId == null) continue;
    records.push({
      key: build.jwId,
      values: [
        build.no,
        build.limitCount,
        build.stdCount,
        build.actualPeriods,
        build.isDefault,
        sectionId,
      ],
    });
  }
  return bulkUpsert(
    tx,
    "ScheduleGroup",
    "jwId",
    "int",
    columns,
    ["int", "int", "int", "int", "boolean", "int"],
    records,
  );
}

async function writeSectionTeachers(
  tx: Prisma.TransactionClient,
  sectionMap: Map<number, number>,
  teacherMap: TeacherMap,
  pairs: SectionTeacherPair[],
  sectionDbIds: number[],
): Promise<void> {
  const resolved: Array<{ sectionId: number; teacherId: number }> = [];
  const seen = new Set<string>();

  for (const pair of pairs) {
    const sectionId = sectionMap.get(pair.sectionJwId);
    if (sectionId == null) continue;
    const teacherId = resolveTeacherId(pair, teacherMap);
    if (teacherId == null) continue;
    const key = `${sectionId}:${teacherId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    resolved.push({ sectionId, teacherId });
  }

  await deleteByColumn(tx, "_SectionTeachers", "A", sectionDbIds);

  for (const chunk of chunks(resolved, 1000)) {
    const values = chunk
      .map((p) => `(${p.sectionId},${p.teacherId})`)
      .join(",");
    await tx.$executeRawUnsafe(
      `INSERT INTO "_SectionTeachers" ("A","B") VALUES ${values} ON CONFLICT DO NOTHING`,
    );
  }

  const now = new Date();
  for (const chunk of chunks(resolved, 1000)) {
    const tuples = chunk
      .map((p) => `(${p.sectionId},${p.teacherId})`)
      .join(",");
    await tx.$executeRawUnsafe(
      `UPDATE "SectionTeacher" SET "retiredAt" = NULL, "updatedAt" = $1 WHERE ("sectionId","teacherId") IN (${tuples})`,
      now,
    );
  }

  if (resolved.length > 0) {
    await tx.sectionTeacher.createMany({
      data: resolved.map((p) => ({
        sectionId: p.sectionId,
        teacherId: p.teacherId,
        retiredAt: null,
      })),
      skipDuplicates: true,
    });
  }

  if (resolved.length === 0 || sectionDbIds.length === 0) {
    return;
  }

  for (const sectionChunk of chunks(sectionDbIds, 1000)) {
    const sectionIds = sectionChunk.join(",");
    await tx.$executeRawUnsafe(
      `UPDATE "SectionTeacher" SET "retiredAt" = $1, "updatedAt" = $2 WHERE "sectionId" IN (${sectionIds}) AND "retiredAt" IS NULL AND ("sectionId","teacherId") NOT IN (SELECT "A","B" FROM "_SectionTeachers" WHERE "A" IN (${sectionIds}))`,
      now,
      now,
    );
  }
}

async function writeTeacherAssignments(
  tx: Prisma.TransactionClient,
  builds: TeacherAssignmentBuild[],
  sectionMap: Map<number, number>,
  teacherMap: TeacherMap,
  teacherLessonTypeMap: Map<number, number>,
): Promise<void> {
  const resolved: Array<{
    teacherId: number;
    sectionId: number;
    role?: string;
    period?: number;
    weekIndices?: number[];
    weekIndicesMsg?: string;
    teacherLessonTypeId?: number;
  }> = [];
  const seen = new Set<string>();

  for (const build of builds) {
    const sectionId = sectionMap.get(build.sectionJwId);
    if (sectionId == null) continue;
    const teacherId = resolveTeacherId(build, teacherMap);
    if (teacherId == null) continue;
    const key = `${sectionId}:${teacherId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    resolved.push({
      teacherId,
      sectionId,
      role: build.role,
      period: build.period,
      weekIndices: build.weekIndices,
      weekIndicesMsg: build.weekIndicesMsg,
      teacherLessonTypeId: build.teacherLessonTypeId
        ? teacherLessonTypeMap.get(build.teacherLessonTypeId)
        : undefined,
    });
  }

  await tx.teacherAssignment.deleteMany({
    where: { sectionId: { in: Array.from(sectionMap.values()) } },
  });

  if (resolved.length > 0) {
    await tx.teacherAssignment.createMany({ data: resolved });
  }
}

async function writeAdminClassSections(
  tx: Prisma.TransactionClient,
  pairs: AdminClassSectionPair[],
  sectionMap: Map<number, number>,
  adminClassMap: Map<number, number>,
): Promise<void> {
  const resolved: Array<{ a: number; b: number }> = [];
  const seen = new Set<string>();
  for (const pair of pairs) {
    const adminClassId = adminClassMap.get(pair.adminClassJwId);
    const sectionId = sectionMap.get(pair.sectionJwId);
    if (adminClassId == null || sectionId == null) continue;
    const key = `${adminClassId}:${sectionId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    resolved.push({ a: adminClassId, b: sectionId });
  }

  await deleteByColumn(
    tx,
    "_SectionAdminClasses",
    "B",
    Array.from(sectionMap.values()),
  );

  for (const chunk of chunks(resolved, 1000)) {
    const values = chunk.map((p) => `(${p.a},${p.b})`).join(",");
    await tx.$executeRawUnsafe(
      `INSERT INTO "_SectionAdminClasses" ("A","B") VALUES ${values} ON CONFLICT DO NOTHING`,
    );
  }
}

async function writeSchedules(
  tx: Prisma.TransactionClient,
  builds: ScheduleBuild[],
  sectionMap: Map<number, number>,
  scheduleGroupMap: Map<number, number>,
  roomMap: Map<number, number>,
  teacherMap: TeacherMap,
  sectionDbIds: number[],
): Promise<void> {
  await tx.schedule.deleteMany({ where: { sectionId: { in: sectionDbIds } } });

  const resolved = builds
    .map((build) => {
      const sectionId = sectionMap.get(build.lessonJwId);
      const scheduleGroupId = scheduleGroupMap.get(build.scheduleGroupJwId);
      if (sectionId == null || scheduleGroupId == null) return undefined;
      const roomId =
        build.roomJwId != null ? roomMap.get(build.roomJwId) : undefined;
      if (build.roomJwId != null && roomId == null) {
        throw new Error(
          `Room jwId ${build.roomJwId} did not resolve for section jwId ${build.lessonJwId}`,
        );
      }
      return {
        periods: build.periods ?? 0,
        date: build.date,
        weekday: build.weekday,
        startTime: build.startTime,
        endTime: build.endTime,
        experiment: build.experiment,
        customPlace: build.customPlace,
        lessonType: build.lessonType,
        weekIndex: build.weekIndex,
        exerciseClass: build.exerciseClass,
        startUnit: build.startUnit,
        endUnit: build.endUnit,
        roomId,
        sectionId,
        scheduleGroupId,
        key: scheduleKey(
          {
            lessonId: sectionId,
            scheduleGroupId,
            date: build.dateStr,
            weekday: build.weekday,
            startTime: build.startTime,
            endTime: build.endTime,
            startUnit: build.startUnit,
            endUnit: build.endUnit,
            customPlace: build.customPlace,
            weekIndex: build.weekIndex,
          },
          roomId,
        ),
        teacherPersonIds: build.teacherPersonIds,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s != null);

  for (const chunk of chunks(resolved, 1000)) {
    const data = chunk.map((c) => ({
      periods: c.periods,
      date: c.date,
      weekday: c.weekday,
      startTime: c.startTime,
      endTime: c.endTime,
      experiment: c.experiment,
      customPlace: c.customPlace,
      lessonType: c.lessonType,
      weekIndex: c.weekIndex,
      exerciseClass: c.exerciseClass,
      startUnit: c.startUnit,
      endUnit: c.endUnit,
      roomId: c.roomId,
      sectionId: c.sectionId,
      scheduleGroupId: c.scheduleGroupId,
    }));
    await tx.schedule.createMany({ data });
  }

  const scheduleRows = await tx.schedule.findMany({
    where: { sectionId: { in: sectionDbIds } },
    select: {
      id: true,
      sectionId: true,
      scheduleGroupId: true,
      date: true,
      weekday: true,
      startTime: true,
      endTime: true,
      startUnit: true,
      endUnit: true,
      customPlace: true,
      weekIndex: true,
      roomId: true,
    },
  });

  const scheduleKeyToId = new Map<string, number>();
  for (const row of scheduleRows) {
    const key = scheduleKey(
      {
        lessonId: row.sectionId,
        scheduleGroupId: row.scheduleGroupId,
        date: row.date == null ? undefined : formatLocalDate(row.date),
        weekday: row.weekday,
        startTime: row.startTime,
        endTime: row.endTime,
        startUnit: row.startUnit,
        endUnit: row.endUnit,
        customPlace: row.customPlace,
        weekIndex: row.weekIndex,
      },
      row.roomId ?? undefined,
    );
    if (!scheduleKeyToId.has(key)) scheduleKeyToId.set(key, row.id);
  }

  const joinPairs: Array<{ scheduleId: number; teacherId: number }> = [];
  const seen = new Set<string>();
  for (const schedule of resolved) {
    const scheduleId = scheduleKeyToId.get(schedule.key);
    if (scheduleId == null) continue;
    for (const personId of schedule.teacherPersonIds) {
      const teacherId = teacherMap.byPersonId.get(personId);
      if (teacherId == null) continue;
      const key = `${scheduleId}:${teacherId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      joinPairs.push({ scheduleId, teacherId });
    }
  }

  for (const chunk of chunks(joinPairs, 1000)) {
    const values = chunk
      .map((p) => `(${p.scheduleId},${p.teacherId})`)
      .join(",");
    await tx.$executeRawUnsafe(
      `INSERT INTO "_ScheduleTeachers" ("A","B") VALUES ${values} ON CONFLICT DO NOTHING`,
    );
  }
}

function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function upsertExams(
  tx: Prisma.TransactionClient,
  builds: ExamBuild[],
  sectionMap: Map<number, number>,
  examBatchMap: Map<string, number>,
): Promise<Map<number, number>> {
  const columns = [
    "examType",
    "startTime",
    "endTime",
    "examDate",
    "examTakeCount",
    "examMode",
    "examBatchId",
    "sectionId",
  ];
  const records: Array<{ key: number; values: ColumnValue[] }> = [];
  for (const build of builds) {
    const sectionId = sectionMap.get(build.sectionJwId);
    if (sectionId == null) continue;
    records.push({
      key: build.jwId,
      values: [
        build.examType,
        build.startTime,
        build.endTime,
        build.examDate,
        build.examTakeCount,
        build.examMode,
        build.examBatchName ? examBatchMap.get(build.examBatchName) : null,
        sectionId,
      ],
    });
  }
  return bulkUpsert(
    tx,
    "Exam",
    "jwId",
    "int",
    columns,
    ["int", "int", "int", "date", "int", "text", "int", "int"],
    records,
  );
}

async function writeExamRooms(
  tx: Prisma.TransactionClient,
  builds: ExamBuild[],
  examMap: Map<number, number>,
): Promise<void> {
  const examIds = builds
    .map((b) => examMap.get(b.jwId))
    .filter((id): id is number => id != null);
  if (examIds.length === 0) return;
  await tx.examRoom.deleteMany({ where: { examId: { in: examIds } } });

  const data: Array<{ examId: number; room: string; count: number }> = [];
  for (const build of builds) {
    const examId = examMap.get(build.jwId);
    if (examId == null) continue;
    for (const room of build.rooms) {
      data.push({ examId, room: room.room, count: room.count });
    }
  }

  if (data.length > 0) {
    await tx.examRoom.createMany({ data });
  }
}

const UNKNOWN_DEPARTMENT_CODE = "static-unknown-department";

function mergePlaceholderDepartments(
  sectionPlaceholders: DepartmentPlaceholderRequest[],
  teachers: TeacherBuild[],
  departments: DepartmentBuild[],
): DepartmentPlaceholderRequest[] {
  const knownCodes = new Set(departments.map((d) => d.code));
  for (const p of sectionPlaceholders) {
    knownCodes.add(p.code);
  }

  const result: DepartmentPlaceholderRequest[] = [...sectionPlaceholders];
  let needsUnknown = false;

  for (const teacher of teachers) {
    const code = teacher.departmentCode;
    if (code == null || code === "") {
      needsUnknown = true;
      continue;
    }
    if (knownCodes.has(code)) continue;
    knownCodes.add(code);
    result.push({ code, nameCn: code });
  }

  if (needsUnknown && !knownCodes.has(UNKNOWN_DEPARTMENT_CODE)) {
    result.push({
      code: UNKNOWN_DEPARTMENT_CODE,
      nameCn: "未知部门 (static import)",
    });
  }

  return result;
}

async function deleteByColumn(
  tx: Prisma.TransactionClient,
  table: string,
  column: string,
  ids: number[],
): Promise<void> {
  for (const chunk of chunks(ids, 1000)) {
    const values = chunk.join(",");
    await tx.$executeRawUnsafe(
      `DELETE FROM "${table}" WHERE "${column}" IN (${values})`,
    );
  }
}

function chunks<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

type ColumnValue =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined
  | Prisma.InputJsonValue;

type BulkUpsertOptions = {
  updateColumns?: string[];
};

async function bulkUpsert<K extends string | number>(
  tx: Prisma.TransactionClient,
  table: string,
  uniqueColumn: string,
  uniqueColumnType: string,
  columns: string[],
  columnTypes: string[],
  records: Array<{ key: K; values: ColumnValue[] }>,
  options: BulkUpsertOptions = {},
): Promise<Map<K, number>> {
  const map = new Map<K, number>();
  if (records.length === 0) return map;

  const allColumns = [uniqueColumn, ...columns];
  const allTypes = [uniqueColumnType, ...columnTypes];
  const updateColumns = options.updateColumns ?? columns;
  if (
    updateColumns.length === 0 ||
    updateColumns.some((column) => !columns.includes(column))
  ) {
    throw new Error(`Invalid bulk upsert update columns for ${table}`);
  }

  const batchSize = 500;
  for (const batch of chunks(records, batchSize)) {
    const params: ColumnValue[] = [];
    const valuePlaceholders: string[] = [];

    for (const record of batch) {
      const placeholders: string[] = [];
      const rowValues = [record.key, ...record.values];
      for (let i = 0; i < rowValues.length; i++) {
        params.push(rowValues[i] ?? null);
        placeholders.push(`$${params.length}::${allTypes[i]}`);
      }
      valuePlaceholders.push(`(${placeholders.join(",")})`);
    }

    const sql = `
      INSERT INTO "${table}" (${allColumns.map((c) => `"${c}"`).join(",")})
      VALUES ${valuePlaceholders.join(",")}
      ON CONFLICT ("${uniqueColumn}") DO UPDATE SET
        ${updateColumns.map((c) => `"${c}" = EXCLUDED."${c}"`).join(",\n        ")}
      RETURNING "id", "${uniqueColumn}"
    `;

    const rows = await tx.$queryRawUnsafe<
      Array<{ id: number } & Record<string, unknown>>
    >(sql, ...params);
    for (const row of rows) {
      map.set(row[uniqueColumn] as K, row.id);
    }
  }

  return map;
}

async function bulkUpdate(
  tx: Prisma.TransactionClient,
  table: string,
  columns: string[],
  columnTypes: string[],
  records: Array<{ id: number; values: ColumnValue[] }>,
): Promise<void> {
  if (records.length === 0) return;

  const batchSize = 500;
  for (const batch of chunks(records, batchSize)) {
    const params: ColumnValue[] = [];
    const valuePlaceholders: string[] = [];

    for (const record of batch) {
      const placeholders: string[] = [];
      for (let i = 0; i < record.values.length; i++) {
        params.push(record.values[i] ?? null);
        placeholders.push(`$${params.length}::${columnTypes[i]}`);
      }
      params.push(record.id);
      placeholders.push(`$${params.length}::int`);
      valuePlaceholders.push(`(${placeholders.join(",")})`);
    }

    const sql = `
      UPDATE "${table}" AS t SET
        ${columns.map((c) => `"${c}" = v."${c}"`).join(",\n        ")}
      FROM (VALUES ${valuePlaceholders.join(",")}) AS v(${columns.map((c) => `"${c}"`).join(",")}, "id")
      WHERE t."id" = v."id"
    `;

    await tx.$executeRawUnsafe(sql, ...params);
  }
}

async function countStats(prisma: PrismaClient): Promise<ImportStats> {
  const [
    semesters,
    departments,
    courses,
    sections,
    teachers,
    scheduleGroups,
    schedules,
    exams,
    rooms,
    buildings,
    campuses,
    adminClasses,
  ] = await Promise.all([
    prisma.semester.count(),
    prisma.department.count(),
    prisma.course.count(),
    prisma.section.count(),
    prisma.teacher.count(),
    prisma.scheduleGroup.count(),
    prisma.schedule.count(),
    prisma.exam.count(),
    prisma.room.count(),
    prisma.building.count(),
    prisma.campus.count(),
    prisma.adminClass.count(),
  ]);

  return {
    semesters,
    departments,
    courses,
    sections,
    teachers,
    scheduleGroups,
    schedules,
    exams,
    rooms,
    buildings,
    campuses,
    adminClasses,
  };
}
