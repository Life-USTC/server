import type { Prisma, PrismaClient } from "../generated/prisma-node/client";
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
  mapAdminClass,
  mapBuilding,
  mapCampus,
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
  if (schemaVersion !== "5") {
    throw new Error(
      `Unsupported snapshot schema version: ${schemaVersion ?? "unknown"}`,
    );
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

  const courses = loadCourses(snapshot);

  const { teacherTitles, teacherLessonTypes, examBatches } =
    loadScheduleLookups(snapshot);

  const { teachers } = loadTeachers(snapshot);

  const { campuses, roomTypes, buildings, rooms, adminClasses } =
    loadScheduleInfrastructure(snapshot);

  const { sections, placeholderDepartments: sectionPlaceholderDepartments } =
    loadSections(
      snapshot,
      config.minSemester,
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

  const runInTransaction = async (tx: Prisma.TransactionClient) => {
    const semesterMap = await upsertSemesters(tx, semesters);
    const departmentMap = await upsertDepartments(
      tx,
      departments,
      placeholderDepartments,
    );
    const lookupMaps = await loadLookupTables(tx, {
      courseCategories,
      courseClassifies,
      courseGradations,
      courseTypes,
      educationLevels,
      classTypes,
      examModes,
      teachLanguages,
    });
    const courseMap = await upsertCourses(tx, courses, lookupMaps);
    const teacherTitleMap = await upsertTeacherTitles(tx, teacherTitles);
    const teacherLessonTypeMap = await upsertTeacherLessonTypes(
      tx,
      teacherLessonTypes,
    );
    const examBatchMap = await upsertExamBatches(tx, examBatches);
    const teacherMap = await upsertTeachers(
      tx,
      teachers,
      departmentMap,
      teacherTitleMap,
    );
    const campusMap = await upsertCampuses(tx, campuses);
    const roomTypeMap = await upsertRoomTypes(tx, roomTypes);
    const buildingMap = await upsertBuildings(tx, buildings, campusMap);
    const roomMap = await upsertRooms(tx, rooms, buildingMap, roomTypeMap);
    const adminClassMap = await upsertAdminClasses(tx, adminClasses);
    const sectionMap = await upsertSections(
      tx,
      sections,
      semesterMap,
      departmentMap,
      courseMap,
      lookupMaps,
      campusMap,
      roomTypeMap,
    );
    const scheduleGroupMap = await upsertScheduleGroups(
      tx,
      scheduleGroups,
      sectionMap,
    );

    const sectionDbIds = Array.from(sectionMap.values());
    await writeSectionTeachers(
      tx,
      sectionMap,
      teacherMap,
      sectionTeacherPairs,
      sectionDbIds,
    );
    await writeTeacherAssignments(
      tx,
      teacherAssignments,
      sectionMap,
      teacherMap,
      teacherLessonTypeMap,
    );
    await writeAdminClassSections(
      tx,
      adminClassSectionPairs,
      sectionMap,
      adminClassMap,
    );

    await writeSchedules(
      tx,
      schedules,
      sectionMap,
      scheduleGroupMap,
      roomMap,
      teacherMap,
      sectionDbIds,
    );

    const examMap = await upsertExams(tx, exams, sectionMap, examBatchMap);
    await writeExamRooms(tx, exams, examMap);

    if (config.dryRun) {
      throw new Error("DRY_RUN: rolling back transaction");
    }
  };

  try {
    await prisma.$transaction(runInTransaction, {
      maxWait: 60_000,
      timeout: 1_800_000,
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

function loadCourses(snapshot: Snapshot): CourseBuild[] {
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

  const result: CourseBuild[] = [];
  const seen = new Set<number>();
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
    if (course == null || seen.has(course.jwId)) continue;
    seen.add(course.jwId);
    result.push(course);
  }
  return result;
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

function loadTeachers(snapshot: Snapshot): {
  teachers: TeacherBuild[];
} {
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

  const teacherMap = new Map<string, TeacherBuild>();
  const byNameDept = new Map<string, TeacherBuild>();

  function teacherKey(build: TeacherBuild): string {
    if (build.personId != null) return `person:${build.personId}`;
    if (build.teacherId != null) return `teacher:${build.teacherId}`;
    if (build.code != null && build.code !== "") return `code:${build.code}`;
    return `name:${build.nameCn}:${build.departmentCode ?? ""}`;
  }

  function nameDeptKey(build: TeacherBuild): string {
    return `${build.nameCn}:${build.departmentCode ?? ""}`;
  }

  function merge(existing: TeacherBuild, incoming: TeacherBuild) {
    existing.personId ??= incoming.personId;
    existing.teacherId ??= incoming.teacherId;
    existing.code ??= incoming.code;
    existing.nameEn ??= incoming.nameEn;
    existing.age ??= incoming.age;
    existing.email ??= incoming.email;
    existing.telephone ??= incoming.telephone;
    existing.mobile ??= incoming.mobile;
    existing.address ??= incoming.address;
    existing.postcode ??= incoming.postcode;
    existing.qq ??= incoming.qq;
    existing.wechat ??= incoming.wechat;
    existing.departmentCode ??= incoming.departmentCode;
    existing.teacherTitleId ??= incoming.teacherTitleId;
  }

  function add(build: TeacherBuild) {
    const primaryKey = teacherKey(build);
    const existingByPrimary = teacherMap.get(primaryKey);
    if (existingByPrimary) {
      merge(existingByPrimary, build);
      return;
    }

    const secondaryKey = nameDeptKey(build);
    const existingByNameDept = byNameDept.get(secondaryKey);
    if (existingByNameDept) {
      merge(existingByNameDept, build);
      teacherMap.set(primaryKey, existingByNameDept);
      return;
    }

    teacherMap.set(primaryKey, build);
    byNameDept.set(secondaryKey, build);
  }

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
      add(build);
    }
  }

  const lessons = snapshot.queryAll("catalog_teach_lesson_list_for_teach");
  for (const lesson of lessons) {
    const parentId = asInt(lesson.store_id);
    if (parentId == null) continue;
    for (const assignment of catalogAssignmentRows.get(parentId) ?? []) {
      const build = mapTeacherFromCatalogAssignment(assignment);
      if (build == null) continue;
      add(build);
    }
  }

  return { teachers: Array.from(teacherMap.values()) };
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

  const campuses = new Map<string, CampusBuild>();
  const buildings = new Map<number, BuildingBuild>();
  const rooms = new Map<number, RoomBuild>();
  const roomTypes = new Map<number, RoomTypeBuild>();
  const adminClasses = new Map<number, AdminClassBuild>();
  const adminClassNames = new Set<string>();

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
          const key = c.nameCn;
          if (!campuses.has(key)) campuses.set(key, c);
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

  for (const row of adminClassRows) {
    const ac = mapAdminClass(row);
    if (ac == null || adminClasses.has(ac.jwId)) continue;
    if (adminClassNames.has(ac.nameCn)) continue;
    adminClassNames.add(ac.nameCn);
    adminClasses.set(ac.jwId, ac);
  }

  return {
    campuses: Array.from(campuses.values()),
    roomTypes: Array.from(roomTypes.values()),
    buildings: Array.from(buildings.values()),
    rooms: Array.from(rooms.values()),
    adminClasses: Array.from(adminClasses.values()),
  };
}

function loadSections(
  snapshot: Snapshot,
  minSemester: number,
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
      sectionTeacherPairs.push({
        sectionJwId: section.jwId,
        nameCn: asString(assignment.cn) ?? "",
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
    const key = scheduleKey(row);
    const personId = asInt(row.personId);
    const existing = schedules.get(key);
    if (existing) {
      mergeSchedule(existing, row, personId ?? undefined);
      continue;
    }

    const room = firstChild(roomMap, asInt(row.store_id) ?? -1);
    const schedule = mapSchedule(row, personId ?? undefined);
    if (room && schedule.roomJwId == null) {
      schedule.roomJwId = asInt(room.id);
    }
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
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  for (const build of builds) {
    const result = await tx.course.upsert({
      where: { jwId: build.jwId },
      create: {
        jwId: build.jwId,
        code: build.code,
        nameCn: build.nameCn,
        nameEn: build.nameEn,
        categoryId: build.categoryName
          ? lookupMaps.courseCategory.get(build.categoryName)
          : undefined,
        classTypeId: build.classTypeName
          ? lookupMaps.classType.get(build.classTypeName)
          : undefined,
        classifyId: build.classifyName
          ? lookupMaps.courseClassify.get(build.classifyName)
          : undefined,
        educationLevelId: build.educationLevelName
          ? lookupMaps.educationLevel.get(build.educationLevelName)
          : undefined,
        gradationId: build.gradationName
          ? lookupMaps.courseGradation.get(build.gradationName)
          : undefined,
        typeId: build.typeName
          ? lookupMaps.courseType.get(build.typeName)
          : undefined,
      },
      update: {
        code: build.code,
        nameCn: build.nameCn,
        nameEn: build.nameEn,
        categoryId: build.categoryName
          ? lookupMaps.courseCategory.get(build.categoryName)
          : undefined,
        classTypeId: build.classTypeName
          ? lookupMaps.classType.get(build.classTypeName)
          : undefined,
        classifyId: build.classifyName
          ? lookupMaps.courseClassify.get(build.classifyName)
          : undefined,
        educationLevelId: build.educationLevelName
          ? lookupMaps.educationLevel.get(build.educationLevelName)
          : undefined,
        gradationId: build.gradationName
          ? lookupMaps.courseGradation.get(build.gradationName)
          : undefined,
        typeId: build.typeName
          ? lookupMaps.courseType.get(build.typeName)
          : undefined,
      },
    });
    map.set(build.jwId, result.id);
  }
  return map;
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

  for (const build of builds) {
    let departmentId = build.departmentCode
      ? departmentMap.get(build.departmentCode)
      : undefined;
    if (departmentId == null) {
      departmentId = unknownDepartmentId;
    }

    const whereClause =
      build.personId != null
        ? { personId: build.personId }
        : build.teacherId != null
          ? { teacherId: build.teacherId }
          : build.code != null && build.code !== ""
            ? { code: build.code }
            : {
                nameCn_departmentId: {
                  nameCn: build.nameCn,
                  departmentId,
                },
              };

    const result = await tx.teacher.upsert({
      // @ts-expect-error where clause union is not statically typed
      where: whereClause,
      create: {
        personId: build.personId,
        teacherId: build.teacherId,
        code: build.code,
        nameCn: build.nameCn,
        nameEn: build.nameEn,
        age: build.age,
        email: build.email,
        telephone: build.telephone,
        mobile: build.mobile,
        address: build.address,
        postcode: build.postcode,
        qq: build.qq,
        wechat: build.wechat,
        departmentId,
        teacherTitleId: build.teacherTitleId
          ? teacherTitleMap.get(build.teacherTitleId)
          : undefined,
      },
      update: {
        nameEn: build.nameEn,
        age: build.age ?? undefined,
        email: build.email ?? undefined,
        telephone: build.telephone ?? undefined,
        mobile: build.mobile ?? undefined,
        address: build.address ?? undefined,
        postcode: build.postcode ?? undefined,
        qq: build.qq ?? undefined,
        wechat: build.wechat ?? undefined,
        departmentId,
        teacherTitleId: build.teacherTitleId
          ? teacherTitleMap.get(build.teacherTitleId)
          : undefined,
      },
    });

    if (build.personId != null) map.byPersonId.set(build.personId, result.id);
    if (build.teacherId != null)
      map.byTeacherId.set(build.teacherId, result.id);
    if (build.code != null && build.code !== "")
      map.byCode.set(build.code, result.id);
    const deptKey = build.departmentCode ?? UNKNOWN_DEPARTMENT_CODE;
    map.byNameDept.set(`${build.nameCn}:${deptKey}`, result.id);
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
  if ("personId" in build && build.personId != null) {
    const id = map.byPersonId.get(build.personId);
    if (id != null) return id;
  }
  if ("teacherId" in build && build.teacherId != null) {
    const id = map.byTeacherId.get(build.teacherId);
    if (id != null) return id;
  }
  if ("code" in build && build.code != null && build.code !== "") {
    const id = map.byCode.get(build.code);
    if (id != null) return id;
  }
  const deptKey = `${build.nameCn}:${build.departmentCode ?? UNKNOWN_DEPARTMENT_CODE}`;
  return map.byNameDept.get(deptKey);
}

async function upsertCampuses(
  tx: Prisma.TransactionClient,
  builds: CampusBuild[],
): Promise<Map<number, number>> {
  const map = new Map<number, number>();

  for (const build of builds) {
    if (build.jwId != null) {
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
    } else {
      await tx.campus.upsert({
        where: { nameCn: build.nameCn },
        create: {
          nameCn: build.nameCn,
          nameEn: build.nameEn,
          code: build.code,
        },
        update: { nameEn: build.nameEn, code: build.code },
      });
    }
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
  const map = new Map<number, number>();
  for (const build of builds) {
    const result = await tx.room.upsert({
      where: { jwId: build.jwId },
      create: {
        jwId: build.jwId,
        nameCn: build.nameCn,
        nameEn: build.nameEn,
        code: build.code,
        floor: build.floor,
        virtual: build.virtual,
        seatsForSection: build.seatsForSection,
        remark: build.remark,
        seats: build.seats,
        buildingId: build.buildingJwId
          ? buildingMap.get(build.buildingJwId)
          : undefined,
        roomTypeId: build.roomTypeJwId
          ? roomTypeMap.get(build.roomTypeJwId)
          : undefined,
      },
      update: {
        nameCn: build.nameCn,
        nameEn: build.nameEn,
        code: build.code,
        floor: build.floor,
        virtual: build.virtual,
        seatsForSection: build.seatsForSection,
        remark: build.remark,
        seats: build.seats,
        buildingId: build.buildingJwId
          ? buildingMap.get(build.buildingJwId)
          : undefined,
        roomTypeId: build.roomTypeJwId
          ? roomTypeMap.get(build.roomTypeJwId)
          : undefined,
      },
    });
    map.set(build.jwId, result.id);
  }
  return map;
}

async function upsertAdminClasses(
  tx: Prisma.TransactionClient,
  builds: AdminClassBuild[],
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  for (const build of builds) {
    const result = await tx.adminClass.upsert({
      where: { jwId: build.jwId },
      create: {
        jwId: build.jwId,
        code: build.code,
        grade: build.grade,
        nameCn: build.nameCn,
        nameEn: build.nameEn,
        stdCount: build.stdCount,
        planCount: build.planCount,
        enabled: build.enabled,
        abbrZh: build.abbrZh,
        abbrEn: build.abbrEn,
      },
      update: {
        code: build.code,
        grade: build.grade,
        nameCn: build.nameCn,
        nameEn: build.nameEn,
        stdCount: build.stdCount,
        planCount: build.planCount,
        enabled: build.enabled,
        abbrZh: build.abbrZh,
        abbrEn: build.abbrEn,
      },
    });
    map.set(build.jwId, result.id);
  }
  return map;
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
  const map = new Map<number, number>();
  for (const build of builds) {
    const courseId = courseMap.get(build.courseJwId);
    if (courseId == null) continue;
    const semesterId = semesterMap.get(build.semesterCode);
    if (semesterId == null) continue;

    const openDepartmentId = build.openDepartmentCode
      ? departmentMap.get(build.openDepartmentCode)
      : undefined;

    const result = await tx.section.upsert({
      where: { jwId: build.jwId },
      create: {
        jwId: build.jwId,
        code: build.code,
        bizTypeId: build.bizTypeId,
        credits: build.credits,
        period: build.period,
        periodsPerWeek: build.periodsPerWeek,
        timesPerWeek: build.timesPerWeek,
        stdCount: build.stdCount,
        limitCount: build.limitCount,
        graduateAndPostgraduate: build.graduateAndPostgraduate,
        dateTimePlaceText: build.dateTimePlaceText,
        dateTimePlacePersonText: build.dateTimePlacePersonText,
        actualPeriods: build.actualPeriods,
        theoryPeriods: build.theoryPeriods,
        practicePeriods: build.practicePeriods,
        experimentPeriods: build.experimentPeriods,
        machinePeriods: build.machinePeriods,
        designPeriods: build.designPeriods,
        testPeriods: build.testPeriods,
        scheduleState: build.scheduleState,
        suggestScheduleWeeks: build.suggestScheduleWeeks,
        suggestScheduleWeekInfo: build.suggestScheduleWeekInfo,
        scheduleJsonParams: build.scheduleJsonParams as Prisma.InputJsonValue,
        selectedStdCount: build.selectedStdCount,
        remark: build.remark,
        scheduleRemark: build.scheduleRemark,
        courseId,
        semesterId,
        campusId:
          build.campusId != null ? campusMap.get(build.campusId) : undefined,
        examModeId: build.examModeName
          ? lookupMaps.examMode.get(build.examModeName)
          : undefined,
        openDepartmentId,
        teachLanguageId: build.teachLanguageName
          ? lookupMaps.teachLanguage.get(build.teachLanguageName)
          : undefined,
        roomTypeId:
          build.roomTypeId != null
            ? roomTypeMap.get(build.roomTypeId)
            : undefined,
      },
      update: {
        code: build.code,
        bizTypeId: build.bizTypeId,
        credits: build.credits,
        period: build.period,
        periodsPerWeek: build.periodsPerWeek,
        timesPerWeek: build.timesPerWeek,
        stdCount: build.stdCount,
        limitCount: build.limitCount,
        graduateAndPostgraduate: build.graduateAndPostgraduate,
        dateTimePlaceText: build.dateTimePlaceText,
        dateTimePlacePersonText: build.dateTimePlacePersonText,
        actualPeriods: build.actualPeriods,
        theoryPeriods: build.theoryPeriods,
        practicePeriods: build.practicePeriods,
        experimentPeriods: build.experimentPeriods,
        machinePeriods: build.machinePeriods,
        designPeriods: build.designPeriods,
        testPeriods: build.testPeriods,
        scheduleState: build.scheduleState,
        suggestScheduleWeeks: build.suggestScheduleWeeks,
        suggestScheduleWeekInfo: build.suggestScheduleWeekInfo,
        scheduleJsonParams: build.scheduleJsonParams as Prisma.InputJsonValue,
        selectedStdCount: build.selectedStdCount,
        remark: build.remark,
        scheduleRemark: build.scheduleRemark,
        courseId,
        semesterId,
        campusId:
          build.campusId != null ? campusMap.get(build.campusId) : undefined,
        examModeId: build.examModeName
          ? lookupMaps.examMode.get(build.examModeName)
          : undefined,
        openDepartmentId,
        teachLanguageId: build.teachLanguageName
          ? lookupMaps.teachLanguage.get(build.teachLanguageName)
          : undefined,
        roomTypeId:
          build.roomTypeId != null
            ? roomTypeMap.get(build.roomTypeId)
            : undefined,
      },
    });
    map.set(build.jwId, result.id);
  }
  return map;
}

async function upsertScheduleGroups(
  tx: Prisma.TransactionClient,
  builds: ScheduleGroupBuild[],
  sectionMap: Map<number, number>,
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  for (const build of builds) {
    const sectionId = sectionMap.get(build.lessonJwId);
    if (sectionId == null) continue;
    const result = await tx.scheduleGroup.upsert({
      where: { jwId: build.jwId },
      create: {
        jwId: build.jwId,
        no: build.no,
        limitCount: build.limitCount,
        stdCount: build.stdCount,
        actualPeriods: build.actualPeriods,
        isDefault: build.isDefault,
        sectionId,
      },
      update: {
        no: build.no,
        limitCount: build.limitCount,
        stdCount: build.stdCount,
        actualPeriods: build.actualPeriods,
        isDefault: build.isDefault,
        sectionId,
      },
    });
    map.set(build.jwId, result.id);
  }
  return map;
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
    for (const pairChunk of chunks(resolved, 1000)) {
      const pairTuples = pairChunk
        .map((p) => `(${p.sectionId},${p.teacherId})`)
        .join(",");
      await tx.$executeRawUnsafe(
        `UPDATE "SectionTeacher" SET "retiredAt" = $1, "updatedAt" = $2 WHERE "sectionId" IN (${sectionIds}) AND "retiredAt" IS NULL AND ("sectionId","teacherId") NOT IN (${pairTuples})`,
        now,
        now,
      );
    }
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
      return {
        periods: build.periods,
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
        roomId:
          build.roomJwId != null ? roomMap.get(build.roomJwId) : undefined,
        sectionId,
        scheduleGroupId,
        key: scheduleBuildKey(build),
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
    },
  });

  const scheduleKeyToId = new Map<string, number>();
  for (const row of scheduleRows) {
    const key = [
      row.sectionId,
      row.scheduleGroupId,
      row.date?.toISOString().split("T")[0] ?? "",
      row.weekday,
      row.startTime,
      row.endTime,
      row.startUnit,
      row.endUnit,
      row.customPlace ?? "",
      row.weekIndex,
    ].join("|");
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

function scheduleBuildKey(build: ScheduleBuild): string {
  return [
    build.lessonJwId,
    build.scheduleGroupJwId,
    build.date?.toISOString().split("T")[0] ?? "",
    build.weekday,
    build.startTime,
    build.endTime,
    build.startUnit,
    build.endUnit,
    build.customPlace ?? "",
    build.weekIndex,
  ].join("|");
}

async function upsertExams(
  tx: Prisma.TransactionClient,
  builds: ExamBuild[],
  sectionMap: Map<number, number>,
  examBatchMap: Map<string, number>,
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  for (const build of builds) {
    const sectionId = sectionMap.get(build.sectionJwId);
    if (sectionId == null) continue;
    const examBatchId = build.examBatchName
      ? examBatchMap.get(build.examBatchName)
      : undefined;
    const result = await tx.exam.upsert({
      where: { jwId: build.jwId },
      create: {
        jwId: build.jwId,
        examType: build.examType,
        startTime: build.startTime,
        endTime: build.endTime,
        examDate: build.examDate,
        examTakeCount: build.examTakeCount,
        examMode: build.examMode,
        examBatchId,
        sectionId,
      },
      update: {
        examType: build.examType,
        startTime: build.startTime,
        endTime: build.endTime,
        examDate: build.examDate,
        examTakeCount: build.examTakeCount,
        examMode: build.examMode,
        examBatchId,
        sectionId,
      },
    });
    map.set(build.jwId, result.id);
  }
  return map;
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
