/** Static snapshot import orchestration (transaction boundaries stay here). */
import type { Prisma, PrismaClient } from "../generated/prisma-node/client";
import {
  loadCatalogLookups,
  loadCourses,
  loadDepartments,
  loadScheduleLookups,
  loadSemesters,
} from "./catalog-plan";
import { deleteMissingSnapshotRows } from "./database-writes";
import { collectCodeOnlyDepartmentPlaceholders } from "./department-placeholder";
import {
  upsertCourses,
  upsertExamBatches,
  upsertTeacherLessonTypes,
  upsertTeachers,
  upsertTeacherTitles,
} from "./import-courses";
import {
  upsertAdminClasses,
  upsertBuildings,
  upsertCampuses,
  upsertRooms,
  upsertRoomTypes,
} from "./import-infrastructure";
import { acquireStaticImportLock } from "./import-lock";
import {
  loadLookupTables,
  upsertDepartments,
  upsertSemesters,
} from "./import-lookups";
import {
  upsertExams,
  upsertScheduleGroups,
  upsertSections,
  writeExamRooms,
} from "./import-sections";
import {
  assertStaticImportStateAllowsSnapshot,
  recordStaticImportState,
  STATIC_IMPORT_TRANSFORM_REVISION,
} from "./import-state";
import type {
  ImportConfig,
  ImportRecordCounts,
  ImportReport,
} from "./import-types";
import { countStats, syncYoungEvents } from "./import-young";
import { loadScheduleInfrastructure } from "./infrastructure-plan";
import type {
  AdminClassSectionPair,
  SectionTeacherPair,
  TeacherAssignmentBuild,
} from "./mappers";
import {
  writeAdminClassSections,
  writeSectionTeachers,
  writeTeacherAssignments,
} from "./relation-writes";
import { writeSchedules } from "./schedule-writes";
import {
  reconcileSectionPresence,
  type SectionPresenceStats,
} from "./section-lifecycle";
import { loadExams, loadScheduleData, loadSections } from "./section-plan";
import { Snapshot } from "./snapshot";
import { loadTeachers } from "./teacher-plan";
import {
  parseSnapshotGeneratedAt,
  validateMappedSectionJwIds,
  validateSnapshotCompleteness,
} from "./validation";
import { loadYoungEvents } from "./young-plan";

export { upsertAdminClasses } from "./import-infrastructure";
export type {
  ImportConfig,
  ImportRecordCounts,
  ImportReport,
} from "./import-types";

export async function runImport(
  prisma: PrismaClient,
  config: ImportConfig,
): Promise<ImportReport> {
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

  if (!config.dryRun) {
    const alreadyImported = await prisma.$transaction(
      async (tx) => {
        await acquireStaticImportLock(tx);
        return assertStaticImportStateAllowsSnapshot(tx, {
          observedAt: snapshotGeneratedAt,
          snapshotSha256: config.snapshotSha256,
          transformRevision: STATIC_IMPORT_TRANSFORM_REVISION,
        });
      },
      { maxWait: 60_000, timeout: 60_000 },
    );
    if (alreadyImported) {
      snapshot.close();
      return {
        mode: "apply",
        outcome: "unchanged",
        snapshot: {
          sha256: config.snapshotSha256,
          schemaVersion,
          generatedAt: metadata.generated_at ?? null,
        },
        plannedRecordCounts: null,
        databaseRecordCounts: null,
        reconciliation: {
          sectionPresence: { status: "already-applied" },
        },
      };
    }
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
    sectionTeacherPairs,
  );
  for (const section of sections) allSectionJwIds.add(section.jwId);
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
  const youngEvents = loadYoungEvents(snapshot);
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
    youngEvents: youngEvents?.length ?? 0,
  };
  let sectionPresenceStats:
    | SectionPresenceStats
    | { status: "already-applied" } = { status: "already-applied" };
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
    const alreadyImported = await logStep("validateStaticImportState", 1, () =>
      assertStaticImportStateAllowsSnapshot(tx, {
        observedAt,
        snapshotSha256: config.snapshotSha256,
        transformRevision: STATIC_IMPORT_TRANSFORM_REVISION,
      }),
    );
    if (alreadyImported && !config.dryRun) {
      unchanged = true;
      return null;
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
    if (youngEvents != null) {
      await logStep("syncYoungEvents", youngEvents.length, () =>
        syncYoungEvents(tx, youngEvents),
      );
    }
    const databaseRecordCounts = await logStep("countDatabaseRecords", 13, () =>
      countStats(tx),
    );
    sectionPresenceStats = await logStep(
      "reconcileSectionPresence",
      sections.length,
      () =>
        reconcileSectionPresence(tx, {
          observedAt,
          scopedSemesterIds,
          seenSectionJwIds: [...allSectionJwIds],
          snapshotSha256: config.snapshotSha256,
        }),
    );
    await logStep("recordStaticImportState", 1, () =>
      recordStaticImportState(tx, {
        observedAt,
        snapshotSha256: config.snapshotSha256,
        transformRevision: STATIC_IMPORT_TRANSFORM_REVISION,
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
      sectionPresence: sectionPresenceStats,
    },
  };
}
