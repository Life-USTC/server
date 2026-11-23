/** Static snapshot import orchestration (transaction boundaries stay here). */
import type { Prisma, PrismaClient } from "../generated/prisma-node/client";
import {
  loadCatalogLookups,
  loadCourses,
  loadDepartments,
  loadScheduleLookups,
  loadSemesters,
} from "./catalog-plan";
import {
  findOfficialCourseConflicts,
  loadCatalogProfiles,
  officialCourseBuilds,
  upsertOfficialProfiles,
} from "./catalog-profiles";
import { loadRelatedCatalog, replaceRelatedCatalog } from "./catalog-related";
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
  changedImportGroups,
  importGroupDigest,
  semesterImportDigests,
} from "./import-groups";
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
import { countStats, syncYoungSnapshot } from "./import-young";
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
import { loadYoungEvents, youngSnapshotSyncedAt } from "./young-plan";

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
  try {
    return await importSnapshot(prisma, config, snapshot);
  } finally {
    snapshot.close();
  }
}

async function importSnapshot(
  prisma: PrismaClient,
  config: ImportConfig,
  snapshot: Snapshot,
): Promise<ImportReport> {
  const metadata = snapshot.metadata();
  const schemaVersion = metadata.schema_version;
  if (schemaVersion !== "6") {
    throw new Error(
      `Unsupported snapshot schema version: ${schemaVersion ?? "unknown"}`,
    );
  }
  const snapshotGeneratedAt = parseSnapshotGeneratedAt(metadata.generated_at);
  const completeness = validateSnapshotCompleteness({
    metadata,
    semesterRows: snapshot.queryAll("catalog_teach_semester_list"),
    catalogLessonRows: snapshot.queryAll("catalog_teach_lesson_list_for_teach"),
    fetchRows: snapshot.queryAll("upstream_fetches"),
  });

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
      return {
        mode: "apply",
        outcome: "unchanged",
        snapshot: {
          sha256: config.snapshotSha256,
          schemaVersion,
          generatedAt: metadata.generated_at ?? null,
        },
        sourceAvailability: {
          unavailableCurriculumSemesterJwIds:
            completeness.unavailableCurriculumSemesterJwIds,
          unavailableExamSemesterJwIds:
            completeness.unavailableExamSemesterJwIds,
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

  const { courses, courseJwIdByParentId } = loadCourses(snapshot);
  const officialProfiles = loadCatalogProfiles(snapshot);
  const relatedCatalog = loadRelatedCatalog(snapshot, metadata);
  const officialProfileCount =
    officialProfiles.courses.length +
    officialProfiles.sections.length +
    officialProfiles.courseIdentityConflicts +
    officialProfiles.sectionIdentityConflicts;
  const officialOnlyCourses = officialCourseBuilds(courses, officialProfiles);
  const catalogLookups = loadCatalogLookups(snapshot);

  const { teacherTitles, teacherLessonTypes, examBatches } =
    loadScheduleLookups(snapshot);

  const { teachers, catalogTeacherJwIdBySectionName } = loadTeachers(snapshot);

  const { campuses, roomTypes, buildings, rooms, adminClasses } =
    loadScheduleInfrastructure(snapshot);

  const sections = loadSections(
    snapshot,
    completeness.catalogMinSemester,
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

  const examSemesterJwIds = new Set(completeness.examSemesterJwIds);
  const exams = loadExams(
    snapshot,
    new Set(
      sections
        .filter((section) => examSemesterJwIds.has(section.semesterCode))
        .map((section) => section.jwId),
    ),
  );
  const plan = {
    sections,
    scheduleGroups,
    schedules,
    sectionTeacherPairs,
    teacherAssignments,
    adminClassSectionPairs,
    exams,
  };
  const groupDigests = semesterImportDigests(sections, examSemesterJwIds, [
    scheduleGroups,
    schedules,
    sectionTeacherPairs,
    teacherAssignments,
    adminClassSectionPairs,
    exams,
  ]);
  groupDigests.set(
    "official-profiles",
    importGroupDigest([
      officialProfiles.courses,
      officialProfiles.sections,
      courses.map(({ jwId, code }) => [jwId, code]),
      sections.map(({ jwId, code, courseJwId, semesterCode }) => [
        jwId,
        code,
        courseJwId,
        semesterCode,
      ]),
      [
        officialProfiles.courseIdentityConflicts,
        officialProfiles.sectionIdentityConflicts,
      ],
    ]),
  );
  // Section pages join these shared records across semesters. Track their
  // mapped content independently of Young and Blackboard snapshot updates.
  const sectionReferenceGroup = "section-reference-data";
  groupDigests.set(
    sectionReferenceGroup,
    importGroupDigest([
      semesters,
      departments,
      courses,
      teachers,
      ...Object.values(catalogLookups),
      teacherTitles,
      teacherLessonTypes,
      examBatches,
      campuses,
      roomTypes,
      buildings,
      rooms,
      adminClasses,
    ]),
  );
  const youngEvents = loadYoungEvents(snapshot);
  const youngSyncedAt = youngSnapshotSyncedAt(snapshot);
  // The write phase needs only mapped records, not the full raw history.
  snapshot.clearCachedRows();
  const plannedRecordCounts: ImportRecordCounts = {
    semesters: semesters.length,
    departments: departments.length + departmentPlaceholders.length,
    courses: courses.length + officialOnlyCourses.length,
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
  const catalogStats: Pick<
    ImportReport["reconciliation"],
    "officialProfiles" | "officialRelationships"
  > = {};
  let sectionPresenceStats:
    | SectionPresenceStats
    | { status: "already-applied" } = { status: "already-applied" };
  const observedAt = snapshotGeneratedAt;
  let unchanged = false;

  async function step<A extends unknown[], R>(
    fn: (...args: A) => Promise<R>,
    ...args: A
  ): Promise<R> {
    const start = Date.now();
    const result = await fn(...args);
    console.log(`${fn.name}: done in ${Date.now() - start}ms`);
    return result;
  }

  const runInTransaction = async (tx: Prisma.TransactionClient) => {
    await step(acquireStaticImportLock, tx);
    const alreadyImported = await step(
      assertStaticImportStateAllowsSnapshot,
      tx,
      {
        observedAt,
        snapshotSha256: config.snapshotSha256,
        transformRevision: STATIC_IMPORT_TRANSFORM_REVISION,
      },
    );
    if (alreadyImported && !config.dryRun) {
      unchanged = true;
      return null;
    }
    const changed = await changedImportGroups(tx, groupDigests);
    console.log(
      `Section reference data: ${changed.has(sectionReferenceGroup) ? "changed" : "unchanged"}`,
    );
    const sections = plan.sections.filter((row) =>
      changed.has(`semester:${row.semesterCode}`),
    );
    const sectionIds = new Set(sections.map((row) => row.jwId));
    const forSections = <T extends { sectionJwId: number }>(rows: T[]) =>
      rows.filter((row) => sectionIds.has(row.sectionJwId));
    const forLessons = <T extends { lessonJwId: number }>(rows: T[]) =>
      rows.filter((row) => sectionIds.has(row.lessonJwId));
    const scheduleGroups = forLessons(plan.scheduleGroups);
    const schedules = forLessons(plan.schedules);
    const sectionTeacherPairs = forSections(plan.sectionTeacherPairs);
    const teacherAssignments = forSections(plan.teacherAssignments);
    const adminClassSectionPairs = forSections(plan.adminClassSectionPairs);
    const exams = forSections(plan.exams);
    console.log(
      `Import groups: ${changed.size} changed, ${groupDigests.size - changed.size} unchanged`,
    );
    const semesterMap = await step(upsertSemesters, tx, semesters);
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
    const departmentMap = await step(
      upsertDepartments,
      tx,
      departments,
      departmentPlaceholders,
    );
    const lookupMaps = await step(
      loadLookupTables,
      tx,
      catalogLookups,
      officialOnlyCourses,
    );
    const courseMap = await step(upsertCourses, tx, courses, lookupMaps);
    const blockedOfficialCourseIds = await findOfficialCourseConflicts(
      tx,
      officialProfiles,
    );
    await upsertCourses(
      tx,
      officialOnlyCourses.filter(
        (course) => !blockedOfficialCourseIds.has(course.jwId),
      ),
      lookupMaps,
      "officialCatalog",
    );
    const teacherTitleMap = await step(upsertTeacherTitles, tx, teacherTitles);
    const teacherLessonTypeMap = await step(
      upsertTeacherLessonTypes,
      tx,
      teacherLessonTypes,
    );
    const examBatchMap = await step(upsertExamBatches, tx, examBatches);
    const teacherMap = await step(upsertTeachers, tx, teachers, departmentMap);
    const campusMap = await step(upsertCampuses, tx, campuses);
    const roomTypeMap = await step(upsertRoomTypes, tx, roomTypes);
    const buildingMap = await step(upsertBuildings, tx, buildings, campusMap);
    const roomMap = await step(
      upsertRooms,
      tx,
      rooms,
      buildingMap,
      roomTypeMap,
    );
    const adminClassMap = await step(upsertAdminClasses, tx, adminClasses);
    const sectionMap = await step(
      upsertSections,
      tx,
      sections,
      semesterMap,
      departmentMap,
      courseMap,
      lookupMaps,
      campusMap,
      roomTypeMap,
    );
    if (officialProfileCount > 0 && changed.has("official-profiles")) {
      const profileStats = await step(
        upsertOfficialProfiles,
        tx,
        officialProfiles,
        blockedOfficialCourseIds,
      );
      catalogStats.officialProfiles = profileStats;
    }
    const scheduleGroupMap = await step(
      upsertScheduleGroups,
      tx,
      scheduleGroups,
      sectionMap,
    );

    const sectionDbIds = Array.from(sectionMap.values());
    const examSectionDbIds = sections
      .filter((section) => examSemesterJwIds.has(section.semesterCode))
      .map((section) => sectionMap.get(section.jwId) as number);
    await step(
      writeSectionTeachers,
      tx,
      sectionMap,
      teacherMap,
      sectionTeacherPairs,
      sectionDbIds,
    );
    await step(
      writeTeacherAssignments,
      tx,
      teacherAssignments,
      sectionMap,
      teacherMap,
      teacherLessonTypeMap,
      teacherTitleMap,
    );
    await step(
      writeAdminClassSections,
      tx,
      adminClassSectionPairs,
      sectionMap,
      adminClassMap,
    );

    await step(
      writeSchedules,
      tx,
      schedules,
      sectionMap,
      scheduleGroupMap,
      roomMap,
      teacherMap,
      sectionDbIds,
    );
    const examMap = await step(
      upsertExams,
      tx,
      exams,
      sectionMap,
      examBatchMap,
    );
    await step(writeExamRooms, tx, exams, examMap);
    await step(async function reconcileRemovedSnapshotRows() {
      await deleteMissingSnapshotRows(
        tx,
        "scheduleGroup",
        sectionDbIds,
        scheduleGroups.map((group) => group.jwId),
      );
      await deleteMissingSnapshotRows(
        tx,
        "exam",
        examSectionDbIds,
        exams.map((exam) => exam.jwId),
      );
    });
    if (
      relatedCatalog.rules ||
      relatedCatalog.directory ||
      relatedCatalog.programs
    ) {
      catalogStats.officialRelationships = await replaceRelatedCatalog(
        tx,
        relatedCatalog,
      );
    }
    const importedYoungSyncedAt =
      youngEvents == null
        ? undefined
        : await step(syncYoungSnapshot, tx, youngEvents, youngSyncedAt);
    const databaseRecordCounts = await step(countStats, tx);
    sectionPresenceStats = await step(reconcileSectionPresence, tx, {
      observedAt,
      scopedSemesterIds,
      seenSectionJwIds: [...allSectionJwIds],
      snapshotSha256: config.snapshotSha256,
    });
    for (const [id, digest] of groupDigests) {
      if (!changed.has(id)) continue;
      await recordStaticImportState(tx, {
        id,
        observedAt,
        snapshotSha256: digest,
        transformRevision: STATIC_IMPORT_TRANSFORM_REVISION,
      });
    }
    await step(recordStaticImportState, tx, {
      observedAt,
      youngSyncedAt: importedYoungSyncedAt,
      snapshotSha256: config.snapshotSha256,
      transformRevision: STATIC_IMPORT_TRANSFORM_REVISION,
    });

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
    sourceAvailability: {
      unavailableCurriculumSemesterJwIds:
        completeness.unavailableCurriculumSemesterJwIds,
      unavailableExamSemesterJwIds: completeness.unavailableExamSemesterJwIds,
    },
    plannedRecordCounts,
    databaseRecordCounts,
    reconciliation: {
      sectionPresence: sectionPresenceStats,
      ...catalogStats,
    },
  };
}
