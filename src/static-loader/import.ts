import type { Prisma, PrismaClient } from "../generated/prisma-node/client";
import {
  loadCatalogLookups,
  loadCourses,
  loadDepartments,
  loadScheduleLookups,
  loadSemesters,
} from "./catalog-plan";
import {
  bulkUpsert,
  type ColumnValue,
  deleteMissingSnapshotRows,
} from "./database-writes";
import { collectCodeOnlyDepartmentPlaceholders } from "./department-placeholder";
import { acquireStaticImportLock } from "./import-lock";
import {
  assertStaticImportStateAllowsSnapshot,
  recordStaticImportState,
  STATIC_IMPORT_TRANSFORM_REVISION,
} from "./import-state";
import { loadScheduleInfrastructure } from "./infrastructure-plan";
import type {
  AdminClassBuild,
  AdminClassSectionPair,
  BuildingBuild,
  CampusBuild,
  CourseBuild,
  DepartmentBuild,
  DepartmentPlaceholderRequest,
  ExamBatchBuild,
  ExamBuild,
  RoomBuild,
  RoomTypeBuild,
  ScheduleGroupBuild,
  SectionBuild,
  SectionTeacherPair,
  SemesterBuild,
  TeacherAssignmentBuild,
  TeacherBuild,
  TeacherLessonTypeBuild,
  TeacherTitleBuild,
} from "./mappers";
import {
  writeAdminClassSections,
  writeSectionTeachers,
  writeTeacherAssignments,
} from "./relation-writes";
import { optionalId, requiredId } from "./required-id";
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
import { loadYoungEvents, type YoungEventBuild } from "./young-plan";

export type ImportConfig = {
  snapshotPath: string;
  snapshotSha256: string;
  minSemester: number;
  dryRun: boolean;
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
  youngEvents: number;
};

export type ImportReport = {
  mode: "apply" | "dry-run";
  outcome: "committed" | "rolled-back" | "unchanged";
  snapshot: {
    sha256: string;
    schemaVersion: string;
    generatedAt: string | null;
  };
  plannedRecordCounts: ImportRecordCounts | null;
  databaseRecordCounts: ImportRecordCounts | null;
  reconciliation: {
    sectionPresence: SectionPresenceStats | { status: "already-applied" };
  };
};

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

async function upsertSemesters(
  tx: Prisma.TransactionClient,
  builds: SemesterBuild[],
): Promise<Map<number, number>> {
  return bulkUpsert(
    tx,
    "Semester",
    "jwId",
    "int",
    ["nameCn", "code", "startDate", "endDate"],
    ["text", "text", "date", "date"],
    builds.map((build) => ({
      key: build.jwId,
      values: [build.nameCn, build.code, build.start, build.end],
    })),
  );
}

async function upsertDepartments(
  tx: Prisma.TransactionClient,
  builds: DepartmentBuild[],
  placeholders: DepartmentPlaceholderRequest[],
): Promise<Map<string, number>> {
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
  const map = new Map<string, number>();
  for (const build of builds) {
    const id = jwIdToId.get(build.jwId);
    if (id != null) map.set(build.code, id);
  }
  for (const placeholder of placeholders) {
    const existing = await tx.department.findFirst({
      where: { code: placeholder.code, jwId: null },
      select: { id: true },
    });
    const id =
      existing?.id ??
      (
        await tx.department.create({
          data: {
            jwId: null,
            code: placeholder.code,
            nameCn: placeholder.nameCn,
            isCollege: false,
          },
          select: { id: true },
        })
      ).id;
    map.set(placeholder.code, id);
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
    table:
      | "CourseCategory"
      | "CourseClassify"
      | "CourseGradation"
      | "CourseType"
      | "EducationLevel"
      | "ClassType"
      | "ExamMode"
      | "TeachLanguage",
    items: { nameCn: string; nameEn?: string }[],
  ) {
    return bulkUpsert(
      tx,
      table,
      "nameCn",
      "text",
      ["nameEn"],
      ["text"],
      items.map((item) => ({ key: item.nameCn, values: [item.nameEn] })),
    );
  }

  return {
    courseCategory: await loadModel("CourseCategory", lookups.courseCategories),
    courseClassify: await loadModel("CourseClassify", lookups.courseClassifies),
    courseGradation: await loadModel(
      "CourseGradation",
      lookups.courseGradations,
    ),
    courseType: await loadModel("CourseType", lookups.courseTypes),
    educationLevel: await loadModel("EducationLevel", lookups.educationLevels),
    classType: await loadModel("ClassType", lookups.classTypes),
    examMode: await loadModel("ExamMode", lookups.examModes),
    teachLanguage: await loadModel("TeachLanguage", lookups.teachLanguages),
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
      optionalId(
        lookupMaps.courseCategory,
        build.categoryName,
        `CourseCategory ${build.categoryName} for Course jwId ${build.jwId}`,
      ),
      optionalId(
        lookupMaps.classType,
        build.classTypeName,
        `ClassType ${build.classTypeName} for Course jwId ${build.jwId}`,
      ),
      optionalId(
        lookupMaps.courseClassify,
        build.classifyName,
        `CourseClassify ${build.classifyName} for Course jwId ${build.jwId}`,
      ),
      optionalId(
        lookupMaps.educationLevel,
        build.educationLevelName,
        `EducationLevel ${build.educationLevelName} for Course jwId ${build.jwId}`,
      ),
      optionalId(
        lookupMaps.courseGradation,
        build.gradationName,
        `CourseGradation ${build.gradationName} for Course jwId ${build.jwId}`,
      ),
      optionalId(
        lookupMaps.courseType,
        build.typeName,
        `CourseType ${build.typeName} for Course jwId ${build.jwId}`,
      ),
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
  return bulkUpsert(
    tx,
    "TeacherTitle",
    "jwId",
    "int",
    ["nameCn", "nameEn", "code", "enabled"],
    ["text", "text", "text", "boolean"],
    builds.map((build) => ({
      key: build.jwId,
      values: [build.nameCn, build.nameEn, build.code, build.enabled],
    })),
  );
}

async function upsertTeacherLessonTypes(
  tx: Prisma.TransactionClient,
  builds: TeacherLessonTypeBuild[],
): Promise<Map<number, number>> {
  return bulkUpsert(
    tx,
    "TeacherLessonType",
    "jwId",
    "int",
    ["nameCn", "nameEn", "code", "role", "enabled"],
    ["text", "text", "text", "text", "boolean"],
    builds.map((build) => ({
      key: build.jwId,
      values: [
        build.nameCn,
        build.nameEn,
        build.code,
        build.role,
        build.enabled,
      ],
    })),
  );
}

async function upsertExamBatches(
  tx: Prisma.TransactionClient,
  builds: ExamBatchBuild[],
): Promise<Map<number, number>> {
  return bulkUpsert(
    tx,
    "ExamBatch",
    "jwId",
    "int",
    ["nameCn"],
    ["text"],
    builds.map((build) => ({ key: build.jwId, values: [build.nameCn] })),
  );
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

async function upsertCampuses(
  tx: Prisma.TransactionClient,
  builds: CampusBuild[],
): Promise<Map<number, number>> {
  return bulkUpsert(
    tx,
    "Campus",
    "jwId",
    "int",
    ["nameCn", "nameEn", "code"],
    ["text", "text", "text"],
    builds.map((build) => ({
      key: build.jwId,
      values: [build.nameCn, build.nameEn, build.code],
    })),
  );
}

async function upsertRoomTypes(
  tx: Prisma.TransactionClient,
  builds: RoomTypeBuild[],
): Promise<Map<number, number>> {
  return bulkUpsert(
    tx,
    "RoomType",
    "jwId",
    "int",
    ["nameCn", "nameEn", "code"],
    ["text", "text", "text"],
    builds.map((build) => ({
      key: build.jwId,
      values: [build.nameCn, build.nameEn, build.code],
    })),
  );
}

async function upsertBuildings(
  tx: Prisma.TransactionClient,
  builds: BuildingBuild[],
  campusMap: Map<number, number>,
): Promise<Map<number, number>> {
  return bulkUpsert(
    tx,
    "Building",
    "jwId",
    "int",
    ["nameCn", "nameEn", "code", "campusId"],
    ["text", "text", "text", "int"],
    builds.map((build) => ({
      key: build.jwId,
      values: [
        build.nameCn,
        build.nameEn,
        build.code,
        build.campusJwId == null
          ? null
          : requiredId(
              campusMap,
              build.campusJwId,
              `Campus jwId ${build.campusJwId} for Building jwId ${build.jwId}`,
            ),
      ],
    })),
  );
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
      build.buildingJwId == null
        ? null
        : requiredId(
            buildingMap,
            build.buildingJwId,
            `Building jwId ${build.buildingJwId} for Room jwId ${build.jwId}`,
          ),
      build.roomTypeJwId == null
        ? null
        : requiredId(
            roomTypeMap,
            build.roomTypeJwId,
            `RoomType jwId ${build.roomTypeJwId} for Room jwId ${build.jwId}`,
          ),
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
    const semesterId = requiredId(
      semesterMap,
      build.semesterCode,
      `Semester jwId ${build.semesterCode} for Section jwId ${build.jwId}`,
    );
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
        build.periodsPerWeek,
        build.timesPerWeek,
        build.stdCount,
        build.limitCount,
        build.graduateAndPostgraduate,
        build.dateTimePlaceText,
        build.dateTimePlacePersonText != null
          ? JSON.stringify(build.dateTimePlacePersonText)
          : null,
        build.actualPeriods,
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
        build.examModeName == null
          ? null
          : requiredId(
              lookupMaps.examMode,
              build.examModeName,
              `ExamMode ${build.examModeName} for Section jwId ${build.jwId}`,
            ),
        openDepartmentId,
        build.teachLanguageName == null
          ? null
          : requiredId(
              lookupMaps.teachLanguage,
              build.teachLanguageName,
              `TeachLanguage ${build.teachLanguageName} for Section jwId ${build.jwId}`,
            ),
        build.roomTypeId == null
          ? null
          : requiredId(
              roomTypeMap,
              build.roomTypeId,
              `RoomType jwId ${build.roomTypeId} for Section jwId ${build.jwId}`,
            ),
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
      "float8",
      "int",
      "int",
      "int",
      "boolean",
      "text",
      "jsonb",
      "float8",
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
    const sectionId = requiredId(
      sectionMap,
      build.lessonJwId,
      `Section jwId ${build.lessonJwId} for ScheduleGroup jwId ${build.jwId}`,
    );
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
    ["int", "int", "int", "float8", "boolean", "int"],
    records,
  );
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
    const sectionId = requiredId(
      sectionMap,
      build.sectionJwId,
      `Section jwId ${build.sectionJwId} for Exam jwId ${build.jwId}`,
    );
    const examBatchId =
      build.examBatchJwId == null
        ? null
        : requiredId(
            examBatchMap,
            build.examBatchJwId,
            `ExamBatch jwId ${build.examBatchJwId} for Exam jwId ${build.jwId}`,
          );
    records.push({
      key: build.jwId,
      values: [
        build.examType,
        build.startTime,
        build.endTime,
        build.examDate,
        build.examTakeCount,
        build.examMode,
        examBatchId,
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
  const examIds = builds.map((build) =>
    requiredId(examMap, build.jwId, `Exam jwId ${build.jwId}`),
  );
  if (examIds.length === 0) return;
  await tx.examRoom.deleteMany({ where: { examId: { in: examIds } } });

  const data: Array<{ examId: number; room: string; count: number }> = [];
  for (const build of builds) {
    const examId = requiredId(examMap, build.jwId, `Exam jwId ${build.jwId}`);
    for (const room of build.rooms) {
      data.push({ examId, room: room.room, count: room.count });
    }
  }

  if (data.length > 0) {
    await tx.examRoom.createMany({ data });
  }
}

async function syncYoungEvents(
  tx: Prisma.TransactionClient,
  builds: YoungEventBuild[],
): Promise<void> {
  const columns = [
    "name",
    "category",
    "department",
    "organizer",
    "status",
    "registrationStatus",
    "location",
    "imageUrl",
    "hours",
    "capacity",
    "appliedCount",
    "startAt",
    "endAt",
    "applyStartAt",
    "applyEndAt",
    "isActive",
    "rawJson",
  ];
  await bulkUpsert(
    tx,
    "YoungEvent",
    "youngId",
    "text",
    columns,
    [
      "text",
      "text",
      "text",
      "text",
      "text",
      "text",
      "text",
      "text",
      "float8",
      "int",
      "int",
      "timestamp",
      "timestamp",
      "timestamp",
      "timestamp",
      "boolean",
      "jsonb",
    ],
    builds.map((build) => ({
      key: build.youngId,
      values: [
        build.name,
        build.category,
        build.department,
        build.organizer,
        build.status,
        build.registrationStatus,
        build.location,
        build.imageUrl,
        build.hours,
        build.capacity,
        build.appliedCount,
        build.startAt,
        build.endAt,
        build.applyStartAt,
        build.applyEndAt,
        build.isActive,
        build.rawJson,
      ] satisfies ColumnValue[],
    })),
  );

  // The snapshot is authoritative for both lists; drop events that disappeared.
  // An empty snapshot means the upstream fetch broke (the ended list alone
  // carries thousands of historical events), so keep existing rows instead of
  // wiping the table.
  if (builds.length === 0) return;
  const keepYoungIds = builds.map((build) => build.youngId);
  await tx.youngEvent.deleteMany({
    where: { youngId: { notIn: keepYoungIds } },
  });
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
    youngEvents,
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
    prisma.youngEvent.count(),
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
    youngEvents,
  };
}
