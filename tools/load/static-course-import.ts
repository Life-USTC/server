import type { PrismaClient } from "../../src/generated/prisma-node/client";
import {
  buildCollisionCheckedStaticNumericIds,
  buildStaticCourseIdentityKeyBySourceId,
  buildStaticCourseImportRows,
  type StaticTeacherReference,
  splitStaticTeacherNames,
  stableStaticNumericId,
  staticCourseMetadataSignature,
  staticDepartmentCode,
  staticTeacherIdentityKey,
  uniqueStaticTeacherReferences,
} from "./static-course-import-helpers";
import {
  type ExamImportRow,
  type ImportDbClient,
  insertScheduleTeachers,
  loadCourseIds,
  loadSectionIds,
  replaceSectionTeachers,
  type ScheduleGroupImportRow,
  type ScheduleImportRow,
  upsertCourses,
  upsertSections,
} from "./static-course-persistence";
import {
  DB_WRITE_BATCH_SIZE,
  forEachChunk,
  SQLITE_READ_BATCH_SIZE,
} from "./static-loader-batches";
import type {
  SnapshotCourse,
  SnapshotExam,
  SnapshotLecture,
  SnapshotSemester,
  StaticSnapshot,
} from "./static-snapshot";

const CHINA_OFFSET_SECONDS = 8 * 60 * 60;

type LookupCache = Map<string, number>;
type NamedLookupFindManyArgs = {
  where: { nameCn: { in: string[] } };
  select: { id: true; nameCn: true };
};
type NamedLookupCreateManyArgs = {
  data: Array<{ nameCn: string }>;
  skipDuplicates: boolean;
};
type NamedLookupDelegate = {
  findMany: (
    args: NamedLookupFindManyArgs,
  ) => Promise<Array<{ id: number; nameCn: string }>>;
  createMany: (args: NamedLookupCreateManyArgs) => Promise<unknown>;
};

type ImportLookupState = {
  courseTypeIdByName: LookupCache;
  courseGradationIdByName: LookupCache;
  courseCategoryIdByName: LookupCache;
  educationLevelIdByName: LookupCache;
  classTypeIdByName: LookupCache;
  departmentIdByName: LookupCache;
  teacherIdByIdentityKey: LookupCache;
};

type StaticCourseImportLogger = {
  info: (message: string) => void;
};

function createImportLookupState(): ImportLookupState {
  return {
    courseTypeIdByName: new Map(),
    courseGradationIdByName: new Map(),
    courseCategoryIdByName: new Map(),
    educationLevelIdByName: new Map(),
    classTypeIdByName: new Map(),
    departmentIdByName: new Map(),
    teacherIdByIdentityKey: new Map(),
  };
}

function buildScheduleGroupJwIdByCourse(courses: SnapshotCourse[]) {
  const courseIdsByLegacyJwId = new Map<number, number[]>();

  for (const course of courses) {
    const legacyJwId = stableStaticNumericId(
      "schedule-group",
      String(course.id),
    );
    const courseIds = courseIdsByLegacyJwId.get(legacyJwId);
    if (courseIds) {
      courseIds.push(course.id);
    } else {
      courseIdsByLegacyJwId.set(legacyJwId, [course.id]);
    }
  }

  const jwIdByCourseId = new Map<number, number>();
  for (const [legacyJwId, courseIds] of courseIdsByLegacyJwId) {
    if (courseIds.length === 1) {
      jwIdByCourseId.set(courseIds[0], legacyJwId);
      continue;
    }

    for (const courseId of courseIds) {
      jwIdByCourseId.set(courseId, courseId);
    }
  }

  return jwIdByCourseId;
}

const splitNames = splitStaticTeacherNames;

function toChinaLocalDate(unixSeconds: number) {
  const shifted = new Date((unixSeconds + CHINA_OFFSET_SECONDS) * 1000);
  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
    ),
  );
}

function toChinaWeekday(unixSeconds: number) {
  const shifted = new Date((unixSeconds + CHINA_OFFSET_SECONDS) * 1000);
  const weekday = shifted.getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

function toWeekIndex(unixSeconds: number, semesterStartSeconds: number) {
  const deltaDays =
    (toChinaLocalDate(unixSeconds).getTime() -
      toChinaLocalDate(semesterStartSeconds).getTime()) /
    86_400_000;
  return Math.floor(deltaDays / 7) + 1;
}

function examTypeToCode(value: string) {
  if (value.includes("期中")) return 1;
  if (value.includes("期末")) return 2;
  return null;
}

function uniqueNames(values: Iterable<string | null | undefined>) {
  return [
    ...new Set(
      [...values]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ];
}

function toDateOnlyString(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function groupByCourseId<T extends { course_id: number }>(rows: T[]) {
  const grouped = new Map<number, T[]>();
  for (const row of rows) {
    const bucket = grouped.get(row.course_id);
    if (bucket) {
      bucket.push(row);
    } else {
      grouped.set(row.course_id, [row]);
    }
  }
  return grouped;
}

function buildExamSourceKeys(
  courses: SnapshotCourse[],
  examsByCourse: ReadonlyMap<number, SnapshotExam[]>,
) {
  return courses.flatMap((course) =>
    (examsByCourse.get(course.id) ?? []).map(
      (_exam, position) => `${course.id}:${position}`,
    ),
  );
}

function dedupeByJwId<T extends { jwId: number }>(rows: T[]) {
  return [...new Map(rows.map((row) => [row.jwId, row])).values()];
}

function collectStaticCourseSignatures(courses: SnapshotCourse[]) {
  const signaturesByCode = new Map<string, Set<string>>();
  for (const course of courses) {
    const code = course.course_code.trim();
    if (!code) {
      throw new Error("Static course code is missing");
    }
    const signatures = signaturesByCode.get(code) ?? new Set<string>();
    signatures.add(staticCourseMetadataSignature(course));
    signaturesByCode.set(code, signatures);
  }
  return signaturesByCode;
}

async function loadExistingCanonicalCourseSignatures(
  db: ImportDbClient,
  courses: SnapshotCourse[],
) {
  const currentSignaturesByCode = collectStaticCourseSignatures(courses);
  const stableJwIdByCode = buildCollisionCheckedStaticNumericIds(
    "course",
    currentSignaturesByCode.keys(),
    "course code",
  );
  const stableCodeByJwId = new Map(
    [...stableJwIdByCode].map(([code, jwId]) => [jwId, code]),
  );
  const canonicalSignatureByCode = new Map<string, string>();

  await forEachChunk(
    [...stableCodeByJwId.keys()],
    SQLITE_READ_BATCH_SIZE,
    async (batch) => {
      const existing = await db.course.findMany({
        where: { jwId: { in: batch } },
        select: {
          jwId: true,
          code: true,
          nameCn: true,
          type: { select: { nameCn: true } },
          gradation: { select: { nameCn: true } },
          category: { select: { nameCn: true } },
          educationLevel: { select: { nameCn: true } },
          classType: { select: { nameCn: true } },
        },
      });

      for (const row of existing) {
        const expectedCode = stableCodeByJwId.get(row.jwId);
        if (!expectedCode || row.code !== expectedCode) {
          continue;
        }

        const courseGradation = row.gradation?.nameCn?.trim();
        const courseCategory = row.category?.nameCn?.trim();
        const educationType = row.educationLevel?.nameCn?.trim();
        const classType = row.classType?.nameCn?.trim();
        if (
          !row.nameCn.trim() ||
          !courseGradation ||
          !courseCategory ||
          !educationType ||
          !classType
        ) {
          continue;
        }

        const signature = staticCourseMetadataSignature({
          id: row.jwId,
          course_code: row.code,
          name: row.nameCn,
          course_type: row.type?.nameCn ?? null,
          course_gradation: courseGradation,
          course_category: courseCategory,
          education_type: educationType,
          class_type: classType,
        });
        if (currentSignaturesByCode.get(row.code)?.has(signature)) {
          canonicalSignatureByCode.set(row.code, signature);
        }
      }
    },
  );

  return canonicalSignatureByCode;
}

function buildScheduleKey(row: {
  sectionId: number;
  scheduleGroupId: number;
  periods: number;
  date: Date | null;
  weekday: number;
  startTime: number;
  endTime: number;
  customPlace: string | null;
  weekIndex: number;
  startUnit: number;
  endUnit: number;
}) {
  return [
    row.sectionId,
    row.scheduleGroupId,
    row.periods,
    toDateOnlyString(row.date) ?? "",
    row.weekday,
    row.startTime,
    row.endTime,
    row.customPlace ?? "",
    row.weekIndex,
    row.startUnit,
    row.endUnit,
  ].join("|");
}

async function measure<T>(
  logger: StaticCourseImportLogger,
  label: string,
  fn: () => Promise<T>,
) {
  const startedAt = performance.now();
  try {
    return await fn();
  } finally {
    const elapsedSeconds = ((performance.now() - startedAt) / 1000).toFixed(2);
    logger.info(`${label} completed in ${elapsedSeconds}s`);
  }
}

async function ensureLookupIds(
  cache: LookupCache,
  delegate: NamedLookupDelegate,
  names: Iterable<string | null | undefined>,
) {
  const unresolved = uniqueNames(names).filter((name) => !cache.has(name));
  if (unresolved.length === 0) {
    return;
  }

  await forEachChunk(unresolved, SQLITE_READ_BATCH_SIZE, async (batch) => {
    const existing = await delegate.findMany({
      where: { nameCn: { in: batch } },
      select: { id: true, nameCn: true },
    });
    for (const row of existing) {
      cache.set(row.nameCn, row.id);
    }
  });

  const missing = unresolved.filter((name) => !cache.has(name));
  if (missing.length > 0) {
    await delegate.createMany({
      data: missing.map((nameCn) => ({ nameCn })),
      skipDuplicates: true,
    });
  }

  await forEachChunk(unresolved, SQLITE_READ_BATCH_SIZE, async (batch) => {
    const resolved = await delegate.findMany({
      where: { nameCn: { in: batch } },
      select: { id: true, nameCn: true },
    });
    for (const row of resolved) {
      cache.set(row.nameCn, row.id);
    }
  });
}

async function ensureDepartments(
  db: ImportDbClient,
  state: ImportLookupState,
  names: Iterable<string | null | undefined>,
) {
  const unresolved = uniqueNames(names).filter(
    (name) => !state.departmentIdByName.has(name),
  );
  if (unresolved.length === 0) {
    return;
  }

  await forEachChunk(unresolved, SQLITE_READ_BATCH_SIZE, async (batch) => {
    const nameByCode = new Map(
      batch.map((name) => [staticDepartmentCode(name), name]),
    );
    const existing = await db.department.findMany({
      where: { code: { in: [...nameByCode.keys()] } },
      select: { id: true, code: true, nameCn: true },
    });
    for (const row of existing) {
      const expectedName = nameByCode.get(row.code);
      if (!expectedName || row.nameCn !== expectedName) {
        throw new Error(
          `Static department code conflict for ${row.code}: expected ${expectedName ?? "unknown"}, found ${row.nameCn}`,
        );
      }
      state.departmentIdByName.set(expectedName, row.id);
    }
  });

  const missing = unresolved.filter(
    (name) => !state.departmentIdByName.has(name),
  );
  if (missing.length > 0) {
    await db.department.createMany({
      data: missing.map((nameCn) => ({
        code: staticDepartmentCode(nameCn),
        nameCn,
        isCollege: false,
      })),
      skipDuplicates: true,
    });
  }

  await forEachChunk(unresolved, SQLITE_READ_BATCH_SIZE, async (batch) => {
    const nameByCode = new Map(
      batch.map((name) => [staticDepartmentCode(name), name]),
    );
    const resolved = await db.department.findMany({
      where: { code: { in: [...nameByCode.keys()] } },
      select: { id: true, code: true, nameCn: true },
    });
    for (const row of resolved) {
      const expectedName = nameByCode.get(row.code);
      if (!expectedName || row.nameCn !== expectedName) {
        throw new Error(
          `Static department code conflict for ${row.code}: expected ${expectedName ?? "unknown"}, found ${row.nameCn}`,
        );
      }
      state.departmentIdByName.set(expectedName, row.id);
    }
  });
}

async function ensureTeachers(
  db: ImportDbClient,
  state: ImportLookupState,
  references: StaticTeacherReference[],
) {
  const unresolved = uniqueStaticTeacherReferences(references).filter(
    (reference) =>
      !state.teacherIdByIdentityKey.has(staticTeacherIdentityKey(reference)),
  );
  if (unresolved.length === 0) {
    return;
  }

  await forEachChunk(unresolved, SQLITE_READ_BATCH_SIZE, async (batch) => {
    const names = [...new Set(batch.map((reference) => reference.nameCn))];
    const existing = await db.teacher.findMany({
      where: { nameCn: { in: names } },
      select: { id: true, nameCn: true, departmentId: true },
      orderBy: { id: "asc" },
    });
    for (const reference of batch) {
      const key = staticTeacherIdentityKey(reference);
      const departmentId = teacherReferenceDepartmentId(state, reference);
      const matches = existing.filter(
        (teacher) =>
          teacher.nameCn === reference.nameCn &&
          teacher.departmentId === departmentId,
      );
      if (matches.length > 1) {
        throw new Error(
          `Ambiguous existing teachers for ${reference.nameCn} in ${reference.departmentName ?? "no department"}`,
        );
      }
      const [teacher] = matches;
      if (teacher) {
        state.teacherIdByIdentityKey.set(key, teacher.id);
      }
    }
  });

  const missing = unresolved.filter(
    (reference) =>
      !state.teacherIdByIdentityKey.has(staticTeacherIdentityKey(reference)),
  );
  if (missing.length > 0) {
    await db.teacher.createMany({
      data: missing.map((reference) => ({
        nameCn: reference.nameCn,
        departmentId: teacherReferenceDepartmentId(state, reference),
      })),
      skipDuplicates: true,
    });
  }

  await forEachChunk(unresolved, SQLITE_READ_BATCH_SIZE, async (batch) => {
    const names = [...new Set(batch.map((reference) => reference.nameCn))];
    const resolved = await db.teacher.findMany({
      where: { nameCn: { in: names } },
      select: { id: true, nameCn: true, departmentId: true },
      orderBy: { id: "asc" },
    });
    for (const reference of batch) {
      const key = staticTeacherIdentityKey(reference);
      const departmentId = teacherReferenceDepartmentId(state, reference);
      const matches = resolved.filter(
        (teacher) =>
          teacher.nameCn === reference.nameCn &&
          teacher.departmentId === departmentId,
      );
      if (matches.length > 1) {
        throw new Error(
          `Ambiguous existing teachers for ${reference.nameCn} in ${reference.departmentName ?? "no department"}`,
        );
      }
      const [teacher] = matches;
      if (teacher) {
        state.teacherIdByIdentityKey.set(key, teacher.id);
      }
    }
  });
}

function teacherReferenceDepartmentId(
  state: ImportLookupState,
  reference: StaticTeacherReference,
) {
  const departmentName = reference.departmentName?.trim();
  if (!departmentName) {
    return null;
  }

  const departmentId = state.departmentIdByName.get(departmentName);
  if (!departmentId) {
    throw new Error(
      `Missing department id for teacher context ${departmentName}`,
    );
  }
  return departmentId;
}

function teacherIdForReference(
  state: ImportLookupState,
  reference: StaticTeacherReference,
) {
  return state.teacherIdByIdentityKey.get(staticTeacherIdentityKey(reference));
}

async function upsertSemester(db: ImportDbClient, semester: SnapshotSemester) {
  return db.semester.upsert({
    where: { jwId: Number.parseInt(semester.id, 10) },
    update: {
      nameCn: semester.name,
      code: semester.id,
      startDate: toChinaLocalDate(semester.start_date),
      endDate: toChinaLocalDate(semester.end_date),
    },
    create: {
      jwId: Number.parseInt(semester.id, 10),
      nameCn: semester.name,
      code: semester.id,
      startDate: toChinaLocalDate(semester.start_date),
      endDate: toChinaLocalDate(semester.end_date),
    },
  });
}

async function createScheduleGroups(
  db: ImportDbClient,
  rows: ScheduleGroupImportRow[],
) {
  const created: Array<{ id: number; jwId: number }> = [];
  await forEachChunk(rows, DB_WRITE_BATCH_SIZE, async (batch) => {
    created.push(
      ...(await db.scheduleGroup.createManyAndReturn({
        data: batch,
        select: { id: true, jwId: true },
      })),
    );
  });
  return new Map(created.map((row) => [row.jwId, row.id]));
}

async function createSchedules(db: ImportDbClient, rows: ScheduleImportRow[]) {
  await forEachChunk(rows, DB_WRITE_BATCH_SIZE, async (batch) => {
    const created = await db.schedule.createManyAndReturn({
      data: batch.map(
        ({ teacherIds: _teacherIds, key: _key, ...schedule }) => schedule,
      ),
      select: {
        id: true,
        sectionId: true,
        scheduleGroupId: true,
        periods: true,
        date: true,
        weekday: true,
        startTime: true,
        endTime: true,
        customPlace: true,
        weekIndex: true,
        startUnit: true,
        endUnit: true,
      },
    });

    const idsByKey = new Map<string, number[]>();
    for (const row of created) {
      const key = buildScheduleKey(row);
      const bucket = idsByKey.get(key);
      if (bucket) {
        bucket.push(row.id);
      } else {
        idsByKey.set(key, [row.id]);
      }
    }

    const teacherLinks: Array<{ scheduleId: number; teacherId: number }> = [];
    for (const row of batch) {
      const scheduleId = idsByKey.get(row.key)?.shift();
      if (!scheduleId) {
        throw new Error(`Unable to resolve schedule id for ${row.key}`);
      }
      for (const teacherId of row.teacherIds) {
        teacherLinks.push({ scheduleId, teacherId });
      }
    }

    await insertScheduleTeachers(db, teacherLinks);
  });
}

async function createExams(db: ImportDbClient, rows: ExamImportRow[]) {
  await forEachChunk(rows, DB_WRITE_BATCH_SIZE, async (batch) => {
    const created = await db.exam.createManyAndReturn({
      data: batch.map(({ rooms: _rooms, ...exam }) => ({
        ...exam,
        examTakeCount: null,
      })),
      select: { id: true, jwId: true },
    });
    const idByJwId = new Map(created.map((row) => [row.jwId, row.id]));

    const rooms = batch.flatMap((exam) => {
      const examId = idByJwId.get(exam.jwId);
      if (!examId) {
        throw new Error(`Unable to resolve exam id for ${exam.jwId}`);
      }
      return exam.rooms.map((room) => ({ examId, room, count: 1 }));
    });

    if (rooms.length > 0) {
      await db.examRoom.createMany({ data: rooms });
    }
  });
}

async function deleteSectionChildren(db: ImportDbClient, sectionIds: number[]) {
  await forEachChunk(sectionIds, SQLITE_READ_BATCH_SIZE, async (batch) => {
    await db.schedule.deleteMany({ where: { sectionId: { in: batch } } });
    await db.scheduleGroup.deleteMany({
      where: { sectionId: { in: batch } },
    });
    await db.exam.deleteMany({ where: { sectionId: { in: batch } } });
  });
}

function courseTeacherReferences(course: SnapshotCourse) {
  return splitNames(course.teacher_name).map((nameCn) => ({
    nameCn,
    departmentName: course.open_department,
    source: `course:${course.id}`,
  }));
}

function lectureTeacherReferences(
  course: SnapshotCourse,
  lecture: SnapshotLecture,
) {
  return splitNames(lecture.teacher_name).map((nameCn) => ({
    nameCn,
    departmentName: course.open_department,
    source: `lecture:${course.id}:${lecture.position}`,
  }));
}

function collectTeacherReferences(
  courses: SnapshotCourse[],
  lecturesByCourse: Map<number, SnapshotLecture[]>,
) {
  return courses.flatMap((course) => [
    ...courseTeacherReferences(course),
    ...(lecturesByCourse.get(course.id) ?? []).flatMap((lecture) =>
      lectureTeacherReferences(course, lecture),
    ),
  ]);
}

async function resolveSemesterLookups(
  db: ImportDbClient,
  state: ImportLookupState,
  courses: SnapshotCourse[],
  lecturesByCourse: Map<number, SnapshotLecture[]>,
) {
  await ensureLookupIds(
    state.courseTypeIdByName,
    db.courseType,
    courses.map((course) => course.course_type),
  );
  await ensureLookupIds(
    state.courseGradationIdByName,
    db.courseGradation,
    courses.map((course) => course.course_gradation),
  );
  await ensureLookupIds(
    state.courseCategoryIdByName,
    db.courseCategory,
    courses.map((course) => course.course_category),
  );
  await ensureLookupIds(
    state.educationLevelIdByName,
    db.educationLevel,
    courses.map((course) => course.education_type),
  );
  await ensureLookupIds(
    state.classTypeIdByName,
    db.classType,
    courses.map((course) => course.class_type),
  );
  await ensureDepartments(
    db,
    state,
    courses.map((course) => course.open_department),
  );
  await ensureTeachers(
    db,
    state,
    collectTeacherReferences(courses, lecturesByCourse),
  );
}

async function importSemesterCourses(
  db: ImportDbClient,
  semester: SnapshotSemester,
  courses: SnapshotCourse[],
  lecturesByCourse: Map<number, SnapshotLecture[]>,
  examsByCourse: Map<number, SnapshotExam[]>,
  state: ImportLookupState,
  courseJwId: (course: SnapshotCourse) => number,
  scheduleGroupJwIdByCourse: Map<number, number>,
  examJwIdBySourceKey: ReadonlyMap<string, number>,
  logger: StaticCourseImportLogger,
) {
  const semesterRecord = await measure(
    logger,
    `Upsert semester ${semester.id}`,
    async () => upsertSemester(db, semester),
  );

  await measure(
    logger,
    `Resolve lookup tables for semester ${semester.id}`,
    async () => resolveSemesterLookups(db, state, courses, lecturesByCourse),
  );

  const courseRows = dedupeByJwId(
    buildStaticCourseImportRows(courses, state, courseJwId),
  );

  await measure(
    logger,
    `Upsert courses for semester ${semester.id}`,
    async () => {
      await upsertCourses(db, courseRows);
    },
  );
  const courseIdByJwId = await measure(
    logger,
    `Load course ids for semester ${semester.id}`,
    async () =>
      loadCourseIds(
        db,
        courseRows.map((course) => course.jwId),
      ),
  );

  const sectionRows = courses.map((course) => {
    const lectures = lecturesByCourse.get(course.id) ?? [];
    const totalPeriods =
      Math.round(lectures.reduce((sum, lecture) => sum + lecture.periods, 0)) ||
      null;
    const courseId = courseIdByJwId.get(courseJwId(course));
    if (!courseId) {
      throw new Error(`Missing course id for ${course.course_code}`);
    }
    return {
      jwId: course.id,
      code: course.lesson_code,
      credits: course.credit,
      period: totalPeriods,
      dateTimePlaceText: course.date_time_place_person_text,
      dateTimePlacePersonText: course.date_time_place_person_text ?? null,
      actualPeriods: totalPeriods,
      scheduleState: lectures.length > 0 ? "STATIC_IMPORTED" : null,
      remark: course.description || null,
      courseId,
      semesterId: semesterRecord.id,
      openDepartmentId: course.open_department
        ? (state.departmentIdByName.get(course.open_department) ?? null)
        : null,
    };
  });

  await measure(
    logger,
    `Upsert sections for semester ${semester.id}`,
    async () => {
      await upsertSections(db, sectionRows);
    },
  );
  const sectionIdByJwId = await measure(
    logger,
    `Load section ids for semester ${semester.id}`,
    async () =>
      loadSectionIds(
        db,
        sectionRows.map((section) => section.jwId),
      ),
  );

  const sectionTeacherLinks = courses.flatMap((course) => {
    const sectionId = sectionIdByJwId.get(course.id);
    if (!sectionId) {
      throw new Error(`Missing section id for ${course.id}`);
    }
    return courseTeacherReferences(course)
      .map((reference) => teacherIdForReference(state, reference))
      .filter((teacherId): teacherId is number => teacherId != null)
      .map((teacherId) => ({ sectionId, teacherId }));
  });

  const sectionIds = [...sectionIdByJwId.values()];
  await measure(
    logger,
    `Replace section teachers for semester ${semester.id}`,
    async () => {
      await replaceSectionTeachers(db, sectionIds, sectionTeacherLinks);
    },
  );
  await measure(
    logger,
    `Delete old schedules and exams for semester ${semester.id}`,
    async () => {
      await deleteSectionChildren(db, sectionIds);
    },
  );

  const scheduleGroupRows: ScheduleGroupImportRow[] = [];
  const scheduleRows: ScheduleImportRow[] = [];
  const examRows: ExamImportRow[] = [];

  for (const course of courses) {
    const sectionId = sectionIdByJwId.get(course.id);
    if (!sectionId) {
      throw new Error(`Missing section id for ${course.id}`);
    }

    const lectures = lecturesByCourse.get(course.id) ?? [];
    const exams = examsByCourse.get(course.id) ?? [];
    const totalPeriods =
      Math.round(lectures.reduce((sum, lecture) => sum + lecture.periods, 0)) ||
      0;

    if (lectures.length > 0) {
      const scheduleGroupJwId = scheduleGroupJwIdByCourse.get(course.id);
      if (!scheduleGroupJwId) {
        throw new Error(`Missing schedule group jwId for course ${course.id}`);
      }
      scheduleGroupRows.push({
        jwId: scheduleGroupJwId,
        sectionId,
        no: 0,
        limitCount: 0,
        stdCount: 0,
        actualPeriods: totalPeriods,
        isDefault: true,
      });
    }

    for (const lecture of lectures) {
      const scheduleGroupJwId = scheduleGroupJwIdByCourse.get(course.id);
      if (!scheduleGroupJwId) {
        throw new Error(`Missing schedule group jwId for course ${course.id}`);
      }
      const teacherIds = lectureTeacherReferences(course, lecture)
        .map((reference) => teacherIdForReference(state, reference))
        .filter((teacherId): teacherId is number => teacherId != null);
      const scheduleRow = {
        sectionId,
        scheduleGroupId: scheduleGroupJwId,
        periods: Math.round(lecture.periods) || 0,
        date: toChinaLocalDate(lecture.start_date),
        weekday: toChinaWeekday(lecture.start_date),
        startTime: lecture.start_hhmm,
        endTime: lecture.end_hhmm,
        customPlace: lecture.location || null,
        weekIndex: toWeekIndex(lecture.start_date, semester.start_date),
        exerciseClass: false,
        startUnit: lecture.start_index,
        endUnit: lecture.end_index,
      };
      scheduleRows.push({
        ...scheduleRow,
        key: buildScheduleKey(scheduleRow),
        teacherIds,
      });
    }

    for (const [position, exam] of exams.entries()) {
      const examSourceKey = `${course.id}:${position}`;
      const examJwId = examJwIdBySourceKey.get(examSourceKey);
      if (!examJwId) {
        throw new Error(`Missing exam jwId for ${examSourceKey}`);
      }
      examRows.push({
        jwId: examJwId,
        sectionId,
        examType: examTypeToCode(exam.exam_type),
        startTime: exam.start_hhmm,
        endTime: exam.end_hhmm,
        examDate: toChinaLocalDate(exam.start_date),
        examMode: exam.exam_mode,
        rooms: exam.location
          .split(/[,，]/)
          .map((room) => room.trim())
          .filter(Boolean),
      });
    }
  }

  const scheduleGroupIdByJwId = await measure(
    logger,
    `Create schedule groups for semester ${semester.id}`,
    async () => createScheduleGroups(db, scheduleGroupRows),
  );

  const normalizedScheduleRows = scheduleRows.map((row) => {
    const scheduleGroupId = scheduleGroupIdByJwId.get(row.scheduleGroupId);
    if (!scheduleGroupId) {
      throw new Error(`Missing schedule group id for ${row.scheduleGroupId}`);
    }
    const resolved = { ...row, scheduleGroupId };
    return { ...resolved, key: buildScheduleKey(resolved) };
  });

  await measure(
    logger,
    `Create schedules for semester ${semester.id}`,
    async () => {
      await createSchedules(db, normalizedScheduleRows);
    },
  );
  await measure(
    logger,
    `Create exams for semester ${semester.id}`,
    async () => {
      await createExams(db, examRows);
    },
  );

  logger.info(
    `Semester ${semester.id} imported: courses=${courses.length}, lectures=${scheduleRows.length}, exams=${examRows.length}`,
  );
}

export async function importStaticCourses(
  db: PrismaClient,
  snapshot: StaticSnapshot,
  minSemesterCode: number,
  logger: StaticCourseImportLogger,
) {
  const semesters = snapshot
    .listSemesters()
    .filter((semester) => Number.parseInt(semester.id, 10) >= minSemesterCode);
  const coursesBySemesterId = new Map(
    semesters.map((semester) => [
      semester.id,
      snapshot.listCoursesForSemester(semester.id),
    ]),
  );
  const examsBySemesterId = await measure(
    logger,
    "Load exams for filtered semesters",
    async () =>
      new Map(
        semesters.map((semester) => [
          semester.id,
          groupByCourseId(snapshot.listExamsForSemester(semester.id)),
        ]),
      ),
  );
  const allCourses = [...coursesBySemesterId.values()].flat();
  const canonicalSignatureByCode = await loadExistingCanonicalCourseSignatures(
    db,
    allCourses,
  );
  const courseIdentityKeyBySourceId = buildStaticCourseIdentityKeyBySourceId(
    allCourses,
    {
      canonicalSignatureByCode,
    },
  );
  const courseJwIdByIdentityKey = buildCollisionCheckedStaticNumericIds(
    "course",
    courseIdentityKeyBySourceId.values(),
    "course",
  );
  const courseJwId = (course: SnapshotCourse) => {
    const identityKey = courseIdentityKeyBySourceId.get(course.id);
    if (!identityKey) {
      throw new Error(`Missing static course identity key for ${course.id}`);
    }
    const jwId = courseJwIdByIdentityKey.get(identityKey);
    if (!jwId) {
      throw new Error(`Missing static course jwId for ${course.id}`);
    }
    return jwId;
  };
  const scheduleGroupJwIdByCourse = buildScheduleGroupJwIdByCourse(allCourses);
  const examJwIdBySourceKey = buildCollisionCheckedStaticNumericIds(
    "exam",
    semesters.flatMap((semester) =>
      buildExamSourceKeys(
        coursesBySemesterId.get(semester.id) ?? [],
        examsBySemesterId.get(semester.id) ?? new Map(),
      ),
    ),
    "exam",
  );
  const state = createImportLookupState();

  logger.info(
    `Filtered to ${semesters.length} semesters (code >= ${minSemesterCode})`,
  );

  for (const semester of semesters) {
    logger.info(`Processing semester: ${semester.name} (${semester.id})`);

    const courses = coursesBySemesterId.get(semester.id) ?? [];
    const lecturesByCourse = await measure(
      logger,
      `Load lectures for semester ${semester.id}`,
      async () =>
        groupByCourseId(snapshot.listLecturesForSemester(semester.id)),
    );
    const examsByCourse = examsBySemesterId.get(semester.id) ?? new Map();

    await db.$transaction(async (tx) => {
      await importSemesterCourses(
        tx,
        semester,
        courses,
        lecturesByCourse,
        examsByCourse,
        state,
        courseJwId,
        scheduleGroupJwIdByCourse,
        examJwIdBySourceKey,
        logger,
      );
    });
  }
}
