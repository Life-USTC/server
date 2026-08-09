import type { Prisma, PrismaClient } from "../generated/prisma-node/client";
import { selectLatestAdminClasses } from "./admin-class-selection";
import { type CampusOccurrence, selectCampuses } from "./campus-selection";
import { type CourseOccurrence, selectLatestCourses } from "./course-selection";
import { collectCodeOnlyDepartmentPlaceholders } from "./department-placeholder";
import { selectLatestExamBatches } from "./exam-batch-selection";
import { acquireStaticImportLock } from "./import-lock";
import {
  assertStaticImportStateAllowsSnapshot,
  recordStaticImportState,
} from "./import-state";
import {
  type AdminClassBuild,
  type AdminClassSectionPair,
  type BuildingBuild,
  type CampusBuild,
  type CourseBuild,
  type DepartmentBuild,
  type DepartmentPlaceholderRequest,
  type ExamBatchBuild,
  type ExamBuild,
  firstChild,
  flattenDepartments,
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
  type TeacherAssignmentBuild,
  type TeacherBuild,
  type TeacherLessonTypeBuild,
  type TeacherTitleBuild,
} from "./mappers";
import {
  assertSectionSnapshotNotOlderThanSource,
  emptySectionLifecycleStats,
  reconcileSectionSourceLifecycle,
  type SectionLifecycleStats,
} from "./section-lifecycle";
import { asInt, asString, Snapshot, type SnapshotRow } from "./snapshot";
import {
  type CatalogTeacherOccurrence,
  planTeacherImport,
  sectionTeacherNameKey,
  type TeacherImportPlan,
  type TeacherOccurrence,
} from "./teacher-identity";
import {
  parseSnapshotGeneratedAt,
  validateMappedSectionJwIds,
  validateSectionRetirementSnapshotApproval,
  validateSnapshotCompleteness,
} from "./validation";

export type ImportConfig = {
  snapshotPath: string;
  snapshotSha256: string;
  minSemester: number;
  dryRun: boolean;
  bootstrapImportState: boolean;
  retireMissingSections: boolean;
  expectedSnapshotSha256: string | null;
  expectedSectionRetirementCandidates: number | null;
};

export type ImportRecordCounts = {
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

export type ImportReport = {
  mode: "apply" | "dry-run";
  outcome: "committed" | "rolled-back" | "unchanged";
  snapshot: {
    sha256: string;
    schemaVersion: string;
    generatedAt: string | null;
  };
  plannedRecordCounts: ImportRecordCounts;
  databaseRecordCounts: ImportRecordCounts | null;
  reconciliation: {
    sectionLifecycle: SectionLifecycleStats;
  };
};

export async function runImport(
  prisma: PrismaClient,
  config: ImportConfig,
): Promise<ImportReport> {
  validateSectionRetirementSnapshotApproval({
    enabled: config.retireMissingSections,
    expectedSnapshotSha256: config.expectedSnapshotSha256,
    snapshotSha256: config.snapshotSha256,
  });
  const snapshot = new Snapshot(config.snapshotPath);
  const metadata = snapshot.metadata();
  const schemaVersion = metadata.schema_version;
  let snapshotGeneratedAt: Date;
  let completeness: ReturnType<typeof validateSnapshotCompleteness>;
  try {
    if (schemaVersion !== "5") {
      throw new Error(
        `Unsupported snapshot schema version: ${schemaVersion ?? "unknown"}`,
      );
    }
    snapshotGeneratedAt = parseSnapshotGeneratedAt(metadata.generated_at);
    completeness = validateSnapshotCompleteness(
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

  const { courses, courseJwIdByParentId } = loadCourses(snapshot);

  const { teacherTitles, teacherLessonTypes, examBatches } =
    loadScheduleLookups(snapshot);

  const { teachers, catalogTeacherJwIdBySectionName } = loadTeachers(snapshot);

  const { campuses, roomTypes, buildings, rooms, adminClasses } =
    loadScheduleInfrastructure(snapshot);

  const sections = loadSections(
    snapshot,
    config.minSemester,
    courseJwIdByParentId,
    catalogTeacherJwIdBySectionName,
    (sectionJwId) => allSectionJwIds.add(sectionJwId),
    sectionTeacherPairs,
  );
  validateMappedSectionJwIds(
    completeness.sectionJwIds,
    sections.map((section) => section.jwId),
  );
  const departmentPlaceholders = collectCodeOnlyDepartmentPlaceholders(
    departments,
    sections,
    teachers,
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
  const plannedRecordCounts: ImportRecordCounts = {
    semesters: semesters.length,
    departments: departments.length + departmentPlaceholders.length,
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
  let sectionLifecycleStats = emptySectionLifecycleStats(
    config.retireMissingSections,
  );
  const observedAt = snapshotGeneratedAt;
  let unchanged = false;

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
    await logStep("acquireStaticImportLock", 1, () =>
      acquireStaticImportLock(tx),
    );
    await logStep("validateStaticIdentityMigration", 1, () =>
      assertStaticIdentityMigrationComplete(tx),
    );
    const alreadyImported = await logStep("validateStaticImportState", 1, () =>
      assertStaticImportStateAllowsSnapshot(tx, {
        bootstrapEnabled: config.bootstrapImportState,
        dryRun: config.dryRun,
        expectedSnapshotSha256: config.expectedSnapshotSha256,
        observedAt,
        retirementEnabled: config.retireMissingSections,
        snapshotSha256: config.snapshotSha256,
      }),
    );
    if (alreadyImported && !config.dryRun && !config.retireMissingSections) {
      unchanged = true;
      return logStep("countDatabaseRecords", 12, () => countStats(tx));
    }
    const semesterMap = await logStep("upsertSemesters", semesters.length, () =>
      upsertSemesters(tx, semesters),
    );
    const scopedSemesterIds = completeness.sectionSemesterJwIds.map(
      (semesterJwId) => {
        const semesterId = semesterMap.get(semesterJwId);
        if (semesterId == null) {
          throw new Error(
            `Validated snapshot semester ${semesterJwId} did not resolve to a database row`,
          );
        }
        return semesterId;
      },
    );
    await logStep("validateSnapshotRecency", scopedSemesterIds.length, () =>
      assertSectionSnapshotNotOlderThanSource(tx, {
        observedAt,
        scopedSemesterIds,
      }),
    );
    const departmentMap = await logStep(
      "upsertDepartments",
      departments.length + departmentPlaceholders.length,
      () => upsertDepartments(tx, departments, departmentPlaceholders),
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
    const courseMap = await logStep("upsertCourses", courses.length, () =>
      upsertCourses(tx, courses, lookupMaps),
    );
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
      upsertTeachers(tx, teachers, departmentMap),
    );
    const campusMap = await logStep("upsertCampuses", campuses.length, () =>
      upsertCampuses(tx, campuses),
    );
    const roomTypeMap = await logStep("upsertRoomTypes", roomTypes.length, () =>
      upsertRoomTypes(tx, roomTypes),
    );
    const buildingMap = await logStep("upsertBuildings", buildings.length, () =>
      upsertBuildings(tx, buildings, campusMap),
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
        teacherTitleMap,
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
        await deleteMissingSnapshotRows(
          tx,
          "scheduleGroup",
          sectionDbIds,
          scheduleGroups.map((group) => group.jwId),
        );
        await deleteMissingSnapshotRows(
          tx,
          "exam",
          sectionDbIds,
          exams.map((exam) => exam.jwId),
        );
      },
    );
    const databaseRecordCounts = await logStep("countDatabaseRecords", 12, () =>
      countStats(tx),
    );
    sectionLifecycleStats = await logStep(
      "reconcileSectionSourceLifecycle",
      sections.length,
      () =>
        reconcileSectionSourceLifecycle(tx, {
          observedAt,
          retirementEnabled: config.retireMissingSections,
          expectedRetirementCandidateCount:
            config.expectedSectionRetirementCandidates,
          scopedSemesterIds,
          seenSectionJwIds: [...allSectionJwIds],
          snapshotSha256: config.snapshotSha256,
        }),
    );
    await logStep("recordStaticImportState", 1, () =>
      recordStaticImportState(tx, {
        observedAt,
        snapshotSha256: config.snapshotSha256,
      }),
    );

    if (config.dryRun) throw new Error("DRY_RUN: rolling back transaction");

    return databaseRecordCounts;
  };

  let databaseRecordCounts: ImportRecordCounts | null = null;
  try {
    databaseRecordCounts = await prisma.$transaction(runInTransaction, {
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

  return {
    mode: config.dryRun ? "dry-run" : "apply",
    outcome: config.dryRun
      ? "rolled-back"
      : unchanged
        ? "unchanged"
        : "committed",
    snapshot: {
      sha256: config.snapshotSha256,
      schemaVersion,
      generatedAt: metadata.generated_at ?? null,
    },
    plannedRecordCounts,
    databaseRecordCounts,
    reconciliation: {
      sectionLifecycle: sectionLifecycleStats,
    },
  };
}

async function assertStaticIdentityMigrationComplete(
  tx: Prisma.TransactionClient,
): Promise<void> {
  const legacyIndexes = await tx.$queryRaw<
    Array<{ indexname: string }>
  >`SELECT indexname
    FROM pg_indexes
    WHERE schemaname = current_schema()
      AND indexname IN (
        'Campus_nameCn_key',
        'AdminClass_nameCn_key',
        'ExamBatch_nameCn_key',
        'TeacherTitle_nameCn_key',
        'Room_buildingId_code_key',
        'Teacher_personId_key',
        'Teacher_teacherId_key',
        'Teacher_code_key'
      )
    ORDER BY indexname`;
  if (legacyIndexes.length > 0) {
    throw new Error(
      `Static identity data migration is incomplete; legacy unique indexes remain: ${legacyIndexes.map(({ indexname }) => indexname).join(", ")}`,
    );
  }
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

  const batchOccurrences: Array<{
    semesterCode: number;
    examBatch: ExamBatchBuild;
  }> = [];
  for (const row of examBatchRows) {
    const b = mapExamBatch(row);
    if (b == null) continue;
    batchOccurrences.push({
      semesterCode: asInt(row.semester_id) ?? 0,
      examBatch: b,
    });
  }

  return {
    teacherTitles: titles,
    teacherLessonTypes: lessonTypes,
    examBatches: selectLatestExamBatches(batchOccurrences),
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
  const catalogAssignmentRows = snapshot.queryGrouped(
    "catalog_teach_lesson_list_for_teach_teacherAssignmentList",
  );

  const scheduleOccurrences: TeacherOccurrence[] = [];
  const catalogOccurrences: CatalogTeacherOccurrence[] = [];

  for (const lesson of scheduleLessonRows) {
    const lessonId = asInt(lesson.id);
    if (lessonId == null) continue;
    const parentId = asInt(lesson.store_id);
    if (parentId == null) continue;
    for (const assignment of assignmentRows.get(parentId) ?? []) {
      if (asString(assignment.name) && asInt(assignment.teacherId) == null) {
        throw new Error(
          `Teacher assignment for section jwId ${lessonId} is missing teacherId`,
        );
      }
      const contact = firstChild(contactRows, asInt(assignment.store_id) ?? -1);
      const build = mapTeacherFromScheduleAssignment(assignment, contact);
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
      const nameCn = asString(assignment.cn);
      if (!nameCn) continue;
      catalogOccurrences.push({
        sectionJwId: lessonId,
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
  const scheduleLessonByJwId = new Map<number, SnapshotRow>();
  for (const row of scheduleLessonRows) {
    const jwId = asInt(row.id);
    if (jwId != null) scheduleLessonByJwId.set(jwId, row);
  }
  const campusOccurrences: CampusOccurrence[] = [];
  const buildings = new Map<number, BuildingBuild>();
  const rooms = new Map<number, RoomBuild>();
  const roomTypes = new Map<number, RoomTypeBuild>();
  const adminClassOccurrences: Array<{
    semesterCode: number;
    adminClass: AdminClassBuild;
  }> = [];

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
          campusOccurrences.push({
            campus: c,
            semesterCode: asInt(campus.semester_id) ?? 0,
            source: "building",
          });
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
    const lessonJwId = asInt(lesson.id);
    const parentId = asInt(lesson.store_id);
    if (lessonJwId == null || parentId == null) continue;
    const campus = mapCampusFromSection(
      scheduleLessonByJwId.get(lessonJwId),
      firstChild(catalogCampusRows, parentId),
    );
    if (campus == null) continue;
    campusOccurrences.push({
      campus,
      semesterCode: asInt(lesson.semester_id) ?? 0,
      source: "catalog",
    });
  }

  for (const row of adminClassRows) {
    const ac = mapAdminClass(row);
    const semesterCode = asInt(row.semester_id);
    if (ac == null || semesterCode == null) continue;
    adminClassOccurrences.push({ semesterCode, adminClass: ac });
  }

  const adminClasses = selectLatestAdminClasses(adminClassOccurrences);

  return {
    campuses: selectCampuses(campusOccurrences),
    roomTypes: Array.from(roomTypes.values()),
    buildings: Array.from(buildings.values()),
    rooms: Array.from(rooms.values()),
    adminClasses,
  };
}

function loadSections(
  snapshot: Snapshot,
  minSemester: number,
  courseJwIdByParentId: Map<number, number>,
  catalogTeacherJwIdBySectionName: Map<string, number>,
  onSection: (jwId: number) => void,
  sectionTeacherPairs: SectionTeacherPair[],
): SectionBuild[] {
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

  const sections: SectionBuild[] = [];

  for (const lesson of lessons) {
    const semesterCode = asInt(lesson.semester_id);
    if (semesterCode == null || semesterCode < minSemester) continue;

    const parentId = asInt(lesson.store_id);
    if (parentId == null) continue;

    const courseRow = firstChild(courses, parentId);
    const courseJwId = courseJwIdByParentId.get(parentId);
    if (courseJwId == null) {
      throw new Error(`Course jwId is missing for lesson parent ${parentId}`);
    }
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
        examMode: firstChild(examModes, parentId),
        openDepartment: openDeptRow,
        teachLanguage: firstChild(teachLanguages, parentId),
      },
    );
    if (section == null) continue;

    sections.push(section);
    onSection(section.jwId);

    for (const assignment of catalogAssignments.get(parentId) ?? []) {
      const nameCn = asString(assignment.cn) ?? "";
      const teacherJwId = catalogTeacherJwIdBySectionName.get(
        sectionTeacherNameKey(section.jwId, nameCn),
      );
      if (teacherJwId != null) {
        sectionTeacherPairs.push({ sectionJwId: section.jwId, teacherJwId });
      }
    }
  }

  return sections;
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
  const teacherTitleRows = snapshot.queryGrouped(
    "jw_ws_schedule_table_datum_result_lessonList_teacherAssignmentList_title",
  );
  const weekIndicesRows = snapshot.queryGrouped(
    "jw_ws_schedule_table_datum_result_lessonList_teacherAssignmentList_weekIndices",
  );
  const adminClassRows = snapshot.queryGrouped(
    "jw_ws_schedule_table_datum_result_lessonList_adminclasses",
  );

  const scheduleInfrastructureTeacherPairs: SectionTeacherPair[] = [];
  const teacherJwIdBySectionPerson = new Map<string, number>();
  for (const lesson of scheduleLessonRows) {
    const lessonId = asInt(lesson.id);
    const parentId = asInt(lesson.store_id);
    if (
      lessonId == null ||
      parentId == null ||
      !importedSectionJwIds.has(lessonId)
    ) {
      continue;
    }
    for (const assignment of assignmentRows.get(parentId) ?? []) {
      const teacherJwId = asInt(assignment.teacherId);
      const nameCn = asString(assignment.name);
      if (nameCn && teacherJwId == null) {
        throw new Error(
          `Teacher assignment for section jwId ${lessonId} is missing teacherId`,
        );
      }
      if (teacherJwId == null) continue;
      const personId = asInt(assignment.personId);
      if (personId == null) continue;
      const key = `${lessonId}:${personId}`;
      const existing = teacherJwIdBySectionPerson.get(key);
      if (existing != null && existing !== teacherJwId) {
        throw new Error(
          `Section jwId ${lessonId} personId ${personId} maps to multiple teacherIds: ${existing}, ${teacherJwId}`,
        );
      }
      teacherJwIdBySectionPerson.set(key, teacherJwId);
    }
  }

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
    const teacherJwId =
      asInt(row.teacherId) ??
      (personId == null
        ? undefined
        : teacherJwIdBySectionPerson.get(`${lessonJwId}:${personId}`));
    if (personId != null && teacherJwId == null) {
      throw new Error(
        `Schedule for section jwId ${lessonJwId} personId ${personId} did not resolve to a teacherId`,
      );
    }
    const existing = schedules.get(key);
    if (existing) {
      mergeSchedule(existing, row, teacherJwId, roomJwId);
      continue;
    }

    const schedule = mapSchedule(row, teacherJwId, roomJwId);
    schedules.set(key, schedule);
  }

  for (const lesson of scheduleLessonRows) {
    const lessonId = asInt(lesson.id);
    if (lessonId == null || !importedSectionJwIds.has(lessonId)) continue;
    const parentId = asInt(lesson.store_id);
    if (parentId == null) continue;

    for (const assignment of assignmentRows.get(parentId) ?? []) {
      const teacherJwId = asInt(assignment.teacherId);
      if (teacherJwId != null) {
        scheduleInfrastructureTeacherPairs.push({
          sectionJwId: lessonId,
          teacherJwId,
        });
      }

      const teacherLessonType = firstChild(
        teacherLessonTypeRows,
        asInt(assignment.store_id) ?? -1,
      );
      const weekIndices =
        weekIndicesRows.get(asInt(assignment.store_id) ?? -1) ?? [];

      const teacherLessonTypeId = asInt(teacherLessonType?.id);
      const teacherTitleJwId = asInt(
        firstChild(teacherTitleRows, asInt(assignment.store_id) ?? -1)?.id,
      );

      const ta = mapTeacherAssignment(
        lessonId,
        assignment,
        weekIndices,
        teacherLessonTypeId ?? undefined,
        teacherTitleJwId ?? undefined,
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
  const incomingCodes = [...new Set(builds.map((build) => build.code))];
  const existingByCode = new Map(
    (
      await tx.department.findMany({
        where: { code: { in: incomingCodes } },
        select: { id: true, jwId: true, code: true },
      })
    ).map((row) => [row.code, row] as const),
  );
  for (const build of builds) {
    const existing = existingByCode.get(build.code);
    if (existing != null && existing.jwId !== build.jwId) {
      throw new Error(
        `Authoritative Department jwId ${build.jwId} conflicts with existing code-only or different-jwId row for code ${build.code}`,
      );
    }
  }

  const jwIdToId = new Map<number, number>();
  for (const build of builds) {
    const result = await tx.department.upsert({
      where: { jwId: build.jwId },
      create: {
        jwId: build.jwId,
        code: build.code,
        nameCn: build.nameCn,
        nameEn: build.nameEn,
        isCollege: build.isCollege,
      },
      update: {
        code: build.code,
        nameCn: build.nameCn,
        nameEn: build.nameEn,
        isCollege: build.isCollege,
      },
    });
    jwIdToId.set(build.jwId, result.id);
  }
  for (const placeholder of placeholders) {
    const existing = await tx.department.findUnique({
      where: { code: placeholder.code },
      select: { id: true, jwId: true },
    });
    if (existing?.jwId != null) {
      throw new Error(
        `Code-only Department reference ${placeholder.code} conflicts with authoritative jwId ${existing.jwId}`,
      );
    }
    if (existing == null) {
      await tx.department.create({
        data: {
          jwId: null,
          code: placeholder.code,
          nameCn: placeholder.nameCn,
          isCollege: false,
        },
      });
    }
  }
  const map = new Map<string, number>();
  for (const build of builds) {
    const id = jwIdToId.get(build.jwId);
    if (id != null) map.set(build.code, id);
  }
  for (const placeholder of placeholders) {
    const row = await tx.department.findUnique({
      where: { code: placeholder.code },
      select: { id: true },
    });
    if (row != null) map.set(placeholder.code, row.id);
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
): Promise<Map<number, number>> {
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
  const records = builds.map((build) => ({
    key: build.jwId,
    values: [
      build.code,
      build.nameCn,
      build.nameEn,
      build.categoryName
        ? lookupMaps.courseCategory.get(build.categoryName)
        : null,
      build.classTypeName
        ? lookupMaps.classType.get(build.classTypeName)
        : null,
      build.classifyName
        ? lookupMaps.courseClassify.get(build.classifyName)
        : null,
      build.educationLevelName
        ? lookupMaps.educationLevel.get(build.educationLevelName)
        : null,
      build.gradationName
        ? lookupMaps.courseGradation.get(build.gradationName)
        : null,
      build.typeName ? lookupMaps.courseType.get(build.typeName) : null,
    ] satisfies ColumnValue[],
  }));
  return bulkUpsert(
    tx,
    "Course",
    "jwId",
    "int",
    columns,
    ["text", "text", "text", "int", "int", "int", "int", "int", "int"],
    records,
  );
}

async function upsertTeacherTitles(
  tx: Prisma.TransactionClient,
  builds: TeacherTitleBuild[],
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  for (const build of builds) {
    const result = await tx.teacherTitle.upsert({
      where: { jwId: build.jwId },
      create: {
        jwId: build.jwId,
        nameCn: build.nameCn,
        nameEn: build.nameEn,
        code: build.code,
        enabled: build.enabled,
      },
      update: {
        nameCn: build.nameCn,
        nameEn: build.nameEn,
        code: build.code,
        enabled: build.enabled,
      },
    });
    map.set(build.jwId, result.id);
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
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  for (const build of builds) {
    const result = await tx.examBatch.upsert({
      where: { jwId: build.jwId },
      create: { jwId: build.jwId, nameCn: build.nameCn },
      update: { nameCn: build.nameCn },
    });
    map.set(build.jwId, result.id);
  }
  return map;
}

async function upsertTeachers(
  tx: Prisma.TransactionClient,
  builds: TeacherBuild[],
  departmentMap: Map<string, number>,
): Promise<TeacherMap> {
  const columns = [
    "personId",
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
  ];

  const resolved = builds.map((build) => {
    const departmentId = build.departmentCode
      ? departmentMap.get(build.departmentCode)
      : undefined;
    return {
      build,
      departmentId,
      key: build.jwId,
      values: [
        build.personId ?? null,
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
      ] satisfies ColumnValue[],
    };
  });
  const unresolvedTeacherDepartmentCodes = new Set(
    resolved
      .filter(
        ({ build, departmentId }) =>
          build.departmentCode && departmentId == null,
      )
      .map(({ build }) => build.departmentCode as string),
  );
  if (unresolvedTeacherDepartmentCodes.size > 0) {
    throw new Error(
      `Teacher department codes have no authoritative upstream Department id: ${[...unresolvedTeacherDepartmentCodes].sort().join(", ")}`,
    );
  }
  return bulkUpsert(
    tx,
    "Teacher",
    "jwId",
    "int",
    columns,
    [
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
    ],
    resolved,
  );
}

type TeacherMap = Map<number, number>;

function resolveTeacherId(
  build: TeacherAssignmentBuild | SectionTeacherPair,
  map: TeacherMap,
): number | undefined {
  return map.get(build.teacherJwId);
}

async function upsertCampuses(
  tx: Prisma.TransactionClient,
  builds: CampusBuild[],
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  for (const build of builds) {
    const result = await tx.campus.upsert({
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

export async function upsertAdminClasses(
  tx: Prisma.TransactionClient,
  builds: AdminClassBuild[],
): Promise<Map<number, number>> {
  const columns = [
    "code",
    "grade",
    "nameCn",
    "nameEn",
    "stdCount",
    "planCount",
    "enabled",
    "abbrZh",
    "abbrEn",
  ];
  const records = builds.map((build) => ({
    key: build.jwId,
    values: [
      build.code,
      build.grade,
      build.nameCn,
      build.nameEn,
      build.stdCount,
      build.planCount,
      build.enabled,
      build.abbrZh,
      build.abbrEn,
    ] satisfies ColumnValue[],
  }));
  return bulkUpsert(
    tx,
    "AdminClass",
    "jwId",
    "int",
    columns,
    ["text", "text", "text", "text", "int", "int", "boolean", "text", "text"],
    records,
  );
}

async function upsertSections(
  tx: Prisma.TransactionClient,
  builds: SectionBuild[],
  semesterMap: Map<number, number>,
  departmentMap: Map<string, number>,
  courseMap: Map<number, number>,
  lookupMaps: LookupMaps,
  campusMap: Map<number, number>,
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
  const unresolvedDepartmentCodes = new Set<string>();
  for (const build of builds) {
    const courseId = courseMap.get(build.courseJwId);
    if (courseId == null) {
      throw new Error(
        `Course jwId ${build.courseJwId} did not resolve for section jwId ${build.jwId}`,
      );
    }
    const semesterId = semesterMap.get(build.semesterCode);
    if (semesterId == null) continue;
    const openDepartmentId = build.openDepartmentCode
      ? departmentMap.get(build.openDepartmentCode)
      : null;
    if (build.openDepartmentCode && openDepartmentId == null) {
      unresolvedDepartmentCodes.add(build.openDepartmentCode);
    }
    const campusId =
      build.campusId == null ? null : campusMap.get(build.campusId);
    if (campusId == null && build.campusId != null) {
      throw new Error(
        `Campus jwId ${build.campusId} did not resolve for section jwId ${build.jwId}`,
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
  if (unresolvedDepartmentCodes.size > 0) {
    throw new Error(
      `Section department codes have no authoritative upstream Department id: ${[...unresolvedDepartmentCodes].sort().join(", ")}`,
    );
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

export async function writeSectionTeachers(
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

  await syncJoinPairs(
    tx,
    "_SectionTeachers",
    "A",
    sectionDbIds,
    resolved.map((pair) => ({ a: pair.sectionId, b: pair.teacherId })),
  );

  const now = new Date();
  for (const chunk of chunks(resolved, 1000)) {
    const tuples = chunk
      .map((p) => `(${p.sectionId},${p.teacherId})`)
      .join(",");
    await tx.$executeRawUnsafe(
      `UPDATE "SectionTeacher" SET "retiredAt" = NULL, "updatedAt" = $1 WHERE ("sectionId","teacherId") IN (${tuples}) AND "retiredAt" IS NOT NULL`,
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

  if (sectionDbIds.length === 0) {
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
  teacherTitleMap: Map<number, number>,
): Promise<void> {
  const resolved: Array<{
    teacherId: number;
    sectionId: number;
    role?: string;
    period?: number;
    weekIndices?: number[];
    weekIndicesMsg?: string;
    teacherLessonTypeId?: number;
    teacherTitleId?: number;
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
      teacherTitleId: build.teacherTitleJwId
        ? teacherTitleMap.get(build.teacherTitleJwId)
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

export async function writeAdminClassSections(
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

  await syncJoinPairs(
    tx,
    "_SectionAdminClasses",
    "B",
    Array.from(sectionMap.values()),
    resolved,
  );
}

export async function writeSchedules(
  tx: Prisma.TransactionClient,
  builds: ScheduleBuild[],
  sectionMap: Map<number, number>,
  scheduleGroupMap: Map<number, number>,
  roomMap: Map<number, number>,
  teacherMap: TeacherMap,
  sectionDbIds: number[],
): Promise<void> {
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
        teacherJwIds: build.teacherJwIds,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s != null);

  const existingRows = await tx.schedule.findMany({
    where: { sectionId: { in: sectionDbIds } },
    select: {
      id: true,
      periods: true,
      date: true,
      weekday: true,
      startTime: true,
      endTime: true,
      experiment: true,
      customPlace: true,
      lessonType: true,
      weekIndex: true,
      exerciseClass: true,
      startUnit: true,
      endUnit: true,
      roomId: true,
      sectionId: true,
      scheduleGroupId: true,
    },
  });

  const existingByKey = new Map<string, (typeof existingRows)[number]>();
  const staleIds: number[] = [];
  for (const row of existingRows) {
    const key = scheduleRowKey(row);
    if (existingByKey.has(key)) {
      staleIds.push(row.id);
    } else {
      existingByKey.set(key, row);
    }
  }

  const desiredKeys = new Set(resolved.map((schedule) => schedule.key));
  const inserts: typeof resolved = [];
  const updates: Array<{ id: number; values: ColumnValue[] }> = [];
  for (const schedule of resolved) {
    const existing = existingByKey.get(schedule.key);
    if (existing == null) {
      inserts.push(schedule);
      continue;
    }
    if (!scheduleRowMatches(existing, schedule)) {
      updates.push({
        id: existing.id,
        values: scheduleColumnValues(schedule),
      });
    }
  }
  for (const [key, row] of existingByKey) {
    if (!desiredKeys.has(key)) staleIds.push(row.id);
  }

  if (staleIds.length > 0) {
    await tx.schedule.deleteMany({ where: { id: { in: staleIds } } });
  }

  await bulkUpdate(
    tx,
    "Schedule",
    SCHEDULE_COLUMNS,
    SCHEDULE_COLUMN_TYPES,
    updates,
  );

  for (const chunk of chunks(inserts, 1000)) {
    await tx.schedule.createMany({
      data: chunk.map(scheduleCreateData),
    });
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
    scheduleKeyToId.set(scheduleRowKey(row), row.id);
  }

  const joinPairs: Array<{ scheduleId: number; teacherId: number }> = [];
  const seen = new Set<string>();
  for (const schedule of resolved) {
    const scheduleId = scheduleKeyToId.get(schedule.key);
    if (scheduleId == null) continue;
    for (const teacherJwId of schedule.teacherJwIds) {
      const teacherId = teacherMap.get(teacherJwId);
      if (teacherId == null) continue;
      const key = `${scheduleId}:${teacherId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      joinPairs.push({ scheduleId, teacherId });
    }
  }

  await syncJoinPairs(
    tx,
    "_ScheduleTeachers",
    "A",
    scheduleRows.map((row) => row.id),
    joinPairs.map((pair) => ({ a: pair.scheduleId, b: pair.teacherId })),
  );
}

const SCHEDULE_COLUMNS = [
  "periods",
  "date",
  "weekday",
  "startTime",
  "endTime",
  "experiment",
  "customPlace",
  "lessonType",
  "weekIndex",
  "exerciseClass",
  "startUnit",
  "endUnit",
  "roomId",
  "sectionId",
  "scheduleGroupId",
];

const SCHEDULE_COLUMN_TYPES = [
  "int",
  "date",
  "int",
  "int",
  "int",
  "text",
  "text",
  "text",
  "int",
  "boolean",
  "int",
  "int",
  "int",
  "int",
  "int",
];

type ResolvedSchedule = {
  periods: number;
  date: Date | undefined;
  weekday: number;
  startTime: number;
  endTime: number;
  experiment: string | undefined;
  customPlace: string | undefined;
  lessonType: string | undefined;
  weekIndex: number;
  exerciseClass: boolean | undefined;
  startUnit: number;
  endUnit: number;
  roomId: number | undefined;
  sectionId: number;
  scheduleGroupId: number;
};

function scheduleColumnValues(schedule: ResolvedSchedule): ColumnValue[] {
  return [
    schedule.periods,
    schedule.date,
    schedule.weekday,
    schedule.startTime,
    schedule.endTime,
    schedule.experiment,
    schedule.customPlace,
    schedule.lessonType,
    schedule.weekIndex,
    schedule.exerciseClass,
    schedule.startUnit,
    schedule.endUnit,
    schedule.roomId,
    schedule.sectionId,
    schedule.scheduleGroupId,
  ];
}

function scheduleCreateData(schedule: ResolvedSchedule) {
  return {
    periods: schedule.periods,
    date: schedule.date,
    weekday: schedule.weekday,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    experiment: schedule.experiment,
    customPlace: schedule.customPlace,
    lessonType: schedule.lessonType,
    weekIndex: schedule.weekIndex,
    exerciseClass: schedule.exerciseClass,
    startUnit: schedule.startUnit,
    endUnit: schedule.endUnit,
    roomId: schedule.roomId,
    sectionId: schedule.sectionId,
    scheduleGroupId: schedule.scheduleGroupId,
  };
}

function scheduleRowKey(row: {
  sectionId: number;
  scheduleGroupId: number;
  date: Date | null;
  weekday: number;
  startTime: number;
  endTime: number;
  startUnit: number;
  endUnit: number;
  customPlace: string | null;
  weekIndex: number;
  roomId: number | null;
}): string {
  return scheduleKey(
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
}

function scheduleRowMatches(
  row: Parameters<typeof scheduleRowKey>[0] & {
    periods: number;
    experiment: string | null;
    lessonType: string | null;
    exerciseClass: boolean | null;
  },
  schedule: ResolvedSchedule,
): boolean {
  const rowValues = [
    row.periods,
    row.date?.getTime(),
    row.weekday,
    row.startTime,
    row.endTime,
    row.experiment ?? undefined,
    row.customPlace ?? undefined,
    row.lessonType ?? undefined,
    row.weekIndex,
    row.exerciseClass ?? undefined,
    row.startUnit,
    row.endUnit,
    row.roomId ?? undefined,
    row.sectionId,
    row.scheduleGroupId,
  ];
  const scheduleValues = scheduleColumnValues(schedule).map((value) =>
    value instanceof Date ? value.getTime() : value,
  );
  return rowValues.every((value, index) => value === scheduleValues[index]);
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
  examBatchMap: Map<number, number>,
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
        build.examBatchJwId != null
          ? examBatchMap.get(build.examBatchJwId)
          : null,
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

export async function syncJoinPairs(
  tx: Prisma.TransactionClient,
  table: string,
  scopeColumn: "A" | "B",
  scopeIds: number[],
  pairs: Array<{ a: number; b: number }>,
): Promise<void> {
  for (const scopeChunk of chunks(scopeIds, 1000)) {
    const scopeSet = new Set(scopeChunk);
    const scopedPairs = pairs.filter((pair) =>
      scopeSet.has(scopeColumn === "A" ? pair.a : pair.b),
    );
    const keepClause =
      scopedPairs.length === 0
        ? ""
        : ` AND NOT EXISTS (
            SELECT 1
            FROM (VALUES ${scopedPairs
              .map((pair) => `(${pair.a},${pair.b})`)
              .join(",")}) AS desired("A","B")
            WHERE desired."A" = target."A" AND desired."B" = target."B"
          )`;
    await tx.$executeRawUnsafe(
      `DELETE FROM "${table}" AS target WHERE target."${scopeColumn}" IN (${scopeChunk.join(",")})${keepClause}`,
    );
  }

  for (const pairChunk of chunks(pairs, 1000)) {
    const values = pairChunk.map((pair) => `(${pair.a},${pair.b})`).join(",");
    await tx.$executeRawUnsafe(
      `INSERT INTO "${table}" ("A","B") VALUES ${values} ON CONFLICT DO NOTHING`,
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

async function deleteMissingSnapshotRows(
  tx: Prisma.TransactionClient,
  model: "exam" | "scheduleGroup",
  sectionDbIds: number[],
  currentJwIds: number[],
) {
  if (sectionDbIds.length === 0) return;

  const keepJwIds = new Set(currentJwIds);
  for (const sectionChunk of chunks(sectionDbIds, 1000)) {
    const existing =
      model === "scheduleGroup"
        ? await tx.scheduleGroup.findMany({
            where: { sectionId: { in: sectionChunk } },
            select: { id: true, jwId: true },
          })
        : await tx.exam.findMany({
            where: { sectionId: { in: sectionChunk } },
            select: { id: true, jwId: true },
          });
    const staleIds = existing
      .filter((row) => !keepJwIds.has(row.jwId))
      .map((row) => row.id);
    for (const idChunk of chunks(staleIds, 1000)) {
      if (idChunk.length === 0) continue;
      if (model === "scheduleGroup") {
        await tx.scheduleGroup.deleteMany({ where: { id: { in: idChunk } } });
      } else {
        await tx.exam.deleteMany({ where: { id: { in: idChunk } } });
      }
    }
  }
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

export async function bulkUpsert<K extends string | number>(
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
      WHERE ROW(${updateColumns.map((c) => `"${table}"."${c}"`).join(",")})
        IS DISTINCT FROM ROW(${updateColumns.map((c) => `EXCLUDED."${c}"`).join(",")})
      RETURNING "id", "${uniqueColumn}"
    `;

    const rows = await tx.$queryRawUnsafe<
      Array<{ id: number } & Record<string, unknown>>
    >(sql, ...params);
    for (const row of rows) {
      map.set(row[uniqueColumn] as K, row.id);
    }

    const missing = batch.filter((record) => !map.has(record.key));
    if (missing.length > 0) {
      const missingRows = await tx.$queryRawUnsafe<
        Array<{ id: number } & Record<string, unknown>>
      >(
        `SELECT "id", "${uniqueColumn}" FROM "${table}" WHERE "${uniqueColumn}" IN (${missing
          .map((_, index) => `$${index + 1}::${uniqueColumnType}`)
          .join(",")})`,
        ...missing.map((record) => record.key),
      );
      for (const row of missingRows) {
        map.set(row[uniqueColumn] as K, row.id);
      }
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

async function countStats(
  prisma: Prisma.TransactionClient,
): Promise<ImportRecordCounts> {
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
