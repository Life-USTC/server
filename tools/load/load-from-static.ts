import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { parseArgs } from "node:util";

import { importBusStaticPayload } from "../../src/features/bus/lib/bus-import";
import type {
  BusStaticCampus,
  BusStaticPayload,
  BusStaticRoute,
  BusStaticRouteSchedule,
} from "../../src/features/bus/lib/bus-types";
import type { Prisma, PrismaClient } from "../../src/generated/prisma/client";
import { createToolPrisma } from "../shared/tool-prisma";

const { values: args } = parseArgs({
  options: {
    "cache-dir": { type: "string", default: "./.cache/life-ustc/static" },
    "min-semester": { type: "string", default: "401" },
    "skip-courses": { type: "boolean", default: false },
    "skip-bus": { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
  strict: true,
});

if (args.help) {
  console.log(`Usage: bun run load:static -- [options]

Options:
  --cache-dir <path>      Snapshot download cache directory (default: .cache/life-ustc/static)
  --min-semester <id>     Minimum semester jwId to import (default: 401)
  --skip-courses          Skip course/exam/schedule import
  --skip-bus              Skip bus data import
  -h, --help              Show this help message`);
  process.exit(0);
}

const cacheDir = args["cache-dir"] ?? "./.cache/life-ustc/static";
const minSemesterJwId = Number.parseInt(args["min-semester"] ?? "401", 10);

const prisma = createToolPrisma();

type SqliteStatement = {
  get: (...params: unknown[]) => unknown;
  all: (...params: unknown[]) => unknown[];
};

type SqliteDatabase = {
  query: (sql: string) => SqliteStatement;
  close: () => void;
};

const { Database } = require("bun:sqlite") as {
  Database: new (
    filename: string,
    options?: { readonly?: boolean },
  ) => SqliteDatabase;
};

type SnapshotSemester = {
  id: string;
  name: string;
  start_date: number;
  end_date: number;
};

type SnapshotCourse = {
  id: number;
  semester_id: string;
  name: string;
  course_code: string;
  lesson_code: string;
  teacher_name: string;
  date_time_place_person_text: string | null;
  course_type: string | null;
  course_gradation: string;
  course_category: string;
  education_type: string;
  class_type: string;
  open_department: string;
  description: string;
  credit: number;
};

type SnapshotLecture = {
  course_id: number;
  position: number;
  start_date: number;
  end_date: number;
  name: string;
  location: string;
  teacher_name: string;
  periods: number;
  start_index: number;
  end_index: number;
  start_hhmm: number;
  end_hhmm: number;
};

type SnapshotExam = {
  course_id: number;
  position: number;
  start_date: number;
  end_date: number;
  name: string;
  location: string;
  exam_type: string;
  start_hhmm: number;
  end_hhmm: number;
  exam_mode: string | null;
};

type SnapshotBusNotice = {
  message: string | null;
  url: string | null;
};

type SnapshotBusCampus = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
};

type SnapshotBusRoute = {
  id: number;
};

type SnapshotBusRouteStop = {
  route_id: number;
  stop_order: number;
  campus_id: number;
};

type SnapshotBusTrip = {
  day_type: "weekday" | "weekend";
  schedule_id: number;
  route_id: number;
  position: number;
};

type SnapshotBusTripStopTime = {
  day_type: "weekday" | "weekend";
  schedule_id: number;
  position: number;
  stop_order: number;
  campus_id: number;
  departure_time: string | null;
};

const logger = {
  info: (msg: string) => console.log(`[INFO] ${msg}`),
  warning: (msg: string) => console.warn(`[WARN] ${msg}`),
  error: (msg: string) => console.error(`[ERROR] ${msg}`),
};

const STATIC_SNAPSHOT_URL =
  "https://static.life-ustc.tiankaima.dev/life-ustc-static.sqlite";

const STATIC_SCHEMA_VERSION = 2;
const CHINA_OFFSET_SECONDS = 8 * 60 * 60;
const SYNTHETIC_JWID_BASE = 1_500_000_000;
const SYNTHETIC_JWID_SPAN = 400_000_000;
const SQLITE_READ_BATCH_SIZE = 5_000;
const DB_WRITE_BATCH_SIZE = 1_000;
const JOIN_WRITE_BATCH_SIZE = 5_000;

type LookupCache = Map<string, number>;
type ImportDbClient = PrismaClient | Prisma.TransactionClient;
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
  teacherIdByName: LookupCache;
};

type CourseImportRow = {
  jwId: number;
  code: string;
  nameCn: string;
  typeId: number | null;
  gradationId: number | null;
  categoryId: number | null;
  educationLevelId: number | null;
  classTypeId: number | null;
};

type SectionImportRow = {
  jwId: number;
  code: string;
  credits: number | null;
  period: number | null;
  dateTimePlaceText: string | null;
  dateTimePlacePersonText: string | null;
  actualPeriods: number | null;
  scheduleState: string | null;
  remark: string | null;
  courseId: number;
  semesterId: number;
  openDepartmentId: number | null;
};

type ScheduleGroupImportRow = {
  jwId: number;
  sectionId: number;
  no: number;
  limitCount: number;
  stdCount: number;
  actualPeriods: number;
  isDefault: boolean;
};

type ScheduleImportRow = {
  key: string;
  sectionId: number;
  scheduleGroupId: number;
  periods: number;
  date: Date | null;
  weekday: number;
  startTime: number;
  endTime: number;
  customPlace: string | null;
  weekIndex: number;
  exerciseClass: boolean;
  startUnit: number;
  endUnit: number;
  teacherIds: number[];
};

type ExamImportRow = {
  jwId: number;
  sectionId: number;
  examType: number | null;
  startTime: number | null;
  endTime: number | null;
  examDate: Date | null;
  examMode: string | null;
  rooms: string[];
};

function stableNumericId(namespace: string, value: string) {
  const digest = createHash("sha256")
    .update(`${namespace}:${value}`)
    .digest("hex");
  return (
    SYNTHETIC_JWID_BASE +
    (Number.parseInt(digest.slice(0, 8), 16) % SYNTHETIC_JWID_SPAN)
  );
}

function stableDepartmentCode(name: string) {
  return `static-${createHash("sha256").update(name).digest("hex").slice(0, 12)}`;
}

function createImportLookupState(): ImportLookupState {
  return {
    courseTypeIdByName: new Map(),
    courseGradationIdByName: new Map(),
    courseCategoryIdByName: new Map(),
    educationLevelIdByName: new Map(),
    classTypeIdByName: new Map(),
    departmentIdByName: new Map(),
    teacherIdByName: new Map(),
  };
}

function buildScheduleGroupJwIdByCourse(courses: SnapshotCourse[]) {
  const courseIdsByLegacyJwId = new Map<number, number[]>();

  for (const course of courses) {
    const legacyJwId = stableNumericId("schedule-group", String(course.id));
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

function examJwIdForCourse(courseId: number, position: number) {
  return stableNumericId("exam", `${courseId}:${position}`);
}

function splitNames(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  return [
    ...new Set(
      value
        .split(/[,，]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

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

class StaticSnapshot {
  private db: SqliteDatabase;
  private statementCache = new Map<string, SqliteStatement>();

  constructor(dbPath: string) {
    this.db = new Database(dbPath, { readonly: true });
  }

  close() {
    this.db.close();
  }

  private statement(sql: string) {
    let statement = this.statementCache.get(sql);
    if (!statement) {
      statement = this.db.query(sql);
      this.statementCache.set(sql, statement);
    }
    return statement;
  }

  private getOne<T>(sql: string, ...params: unknown[]) {
    return this.statement(sql).get(...params) as T | null;
  }

  private getAll<T>(sql: string, ...params: unknown[]) {
    return this.statement(sql).all(...params) as T[];
  }

  getMetadata(key: string) {
    const row = this.getOne<{ value: string }>(
      "SELECT value FROM metadata WHERE key = ?",
      key,
    );
    return row?.value ?? null;
  }

  assertSupportedSchema() {
    const schemaVersion = Number.parseInt(
      this.getMetadata("schema_version") ?? "",
      10,
    );
    if (schemaVersion !== STATIC_SCHEMA_VERSION) {
      throw new Error(
        `Unsupported static snapshot schema version: ${schemaVersion || "unknown"}`,
      );
    }
  }

  listSemesters() {
    return this.getAll<SnapshotSemester>(
      "SELECT id, name, start_date, end_date FROM semesters ORDER BY CAST(id AS INTEGER) DESC",
    );
  }

  listCoursesForSemester(semesterId: string) {
    return this.getAll<SnapshotCourse>(
      `
      SELECT
        id,
        semester_id,
        name,
        course_code,
        lesson_code,
        teacher_name,
        date_time_place_person_text,
        course_type,
        course_gradation,
        course_category,
        education_type,
        class_type,
        open_department,
        description,
        credit
      FROM courses
      WHERE semester_id = ?
      ORDER BY lesson_code ASC, id ASC
      `,
      semesterId,
    );
  }

  listLecturesForSemester(semesterId: string) {
    return this.getAll<SnapshotLecture>(
      `
      SELECT
        lectures.course_id,
        lectures.position,
        lectures.start_date,
        lectures.end_date,
        lectures.name,
        lectures.location,
        lectures.teacher_name,
        lectures.periods,
        lectures.start_index,
        lectures.end_index,
        lectures.start_hhmm,
        lectures.end_hhmm
      FROM course_lectures AS lectures
      INNER JOIN courses ON courses.id = lectures.course_id
      WHERE courses.semester_id = ?
      ORDER BY lectures.course_id ASC, lectures.position ASC
      `,
      semesterId,
    );
  }

  listExamsForSemester(semesterId: string) {
    return this.getAll<SnapshotExam>(
      `
      SELECT
        exams.course_id,
        exams.position,
        exams.start_date,
        exams.end_date,
        exams.name,
        exams.location,
        exams.exam_type,
        exams.start_hhmm,
        exams.end_hhmm,
        exams.exam_mode
      FROM course_exams AS exams
      INNER JOIN courses ON courses.id = exams.course_id
      WHERE courses.semester_id = ?
      ORDER BY exams.course_id ASC, exams.position ASC
      `,
      semesterId,
    );
  }

  getBusNotice() {
    return this.getOne<SnapshotBusNotice>(
      "SELECT message, url FROM bus_notice WHERE id = 1",
    );
  }

  listBusCampuses() {
    return this.getAll<SnapshotBusCampus>(
      "SELECT id, name, latitude, longitude FROM bus_campuses ORDER BY id ASC",
    );
  }

  listBusRoutes() {
    return this.getAll<SnapshotBusRoute>(
      "SELECT id FROM bus_routes ORDER BY id ASC",
    );
  }

  listBusRouteStops() {
    return this.getAll<SnapshotBusRouteStop>(
      "SELECT route_id, stop_order, campus_id FROM bus_route_stops ORDER BY route_id ASC, stop_order ASC",
    );
  }

  listBusTrips(dayType: "weekday" | "weekend") {
    return this.getAll<SnapshotBusTrip>(
      `
      SELECT day_type, schedule_id, route_id, position
      FROM bus_trips
      WHERE day_type = ?
      ORDER BY schedule_id ASC, position ASC
      `,
      dayType,
    );
  }

  listBusTripStopTimes(dayType: "weekday" | "weekend") {
    return this.getAll<SnapshotBusTripStopTime>(
      `
      SELECT day_type, schedule_id, position, stop_order, campus_id, departure_time
      FROM bus_trip_stop_times
      WHERE day_type = ?
      ORDER BY schedule_id ASC, position ASC, stop_order ASC
      `,
      dayType,
    );
  }
}

async function downloadStaticSnapshot(targetDir: string): Promise<string> {
  const snapshotPath = path.join(targetDir, "life-ustc-static.sqlite");
  fs.mkdirSync(targetDir, { recursive: true });

  logger.info(`Downloading static snapshot from ${STATIC_SNAPSHOT_URL}`);
  const response = await fetch(STATIC_SNAPSHOT_URL, {
    headers: { "user-agent": "life-ustc-static-import/1.0" },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(snapshotPath, bytes);
  return snapshotPath;
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function forEachChunk<T>(
  items: T[],
  size: number,
  fn: (chunk: T[]) => Promise<void>,
) {
  for (const chunk of chunkArray(items, size)) {
    await fn(chunk);
  }
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

function dedupeByJwId<T extends { jwId: number }>(rows: T[]) {
  return [...new Map(rows.map((row) => [row.jwId, row])).values()];
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

async function measure<T>(label: string, fn: () => Promise<T>) {
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
    const existing = await db.department.findMany({
      where: { nameCn: { in: batch } },
      select: { id: true, nameCn: true },
    });
    for (const row of existing) {
      state.departmentIdByName.set(row.nameCn, row.id);
    }
  });

  const missing = unresolved.filter(
    (name) => !state.departmentIdByName.has(name),
  );
  if (missing.length > 0) {
    await db.department.createMany({
      data: missing.map((nameCn) => ({
        code: stableDepartmentCode(nameCn),
        nameCn,
        isCollege: false,
      })),
      skipDuplicates: true,
    });
  }

  await forEachChunk(unresolved, SQLITE_READ_BATCH_SIZE, async (batch) => {
    const resolved = await db.department.findMany({
      where: { nameCn: { in: batch } },
      select: { id: true, nameCn: true },
    });
    for (const row of resolved) {
      state.departmentIdByName.set(row.nameCn, row.id);
    }
  });
}

async function ensureTeachers(
  db: ImportDbClient,
  state: ImportLookupState,
  names: Iterable<string | null | undefined>,
) {
  const unresolved = uniqueNames(names).filter(
    (name) => !state.teacherIdByName.has(name),
  );
  if (unresolved.length === 0) {
    return;
  }

  await forEachChunk(unresolved, SQLITE_READ_BATCH_SIZE, async (batch) => {
    const existing = await db.teacher.findMany({
      where: { nameCn: { in: batch } },
      select: { id: true, nameCn: true, departmentId: true },
      orderBy: { id: "asc" },
    });
    for (const name of batch) {
      const matches = existing.filter((teacher) => teacher.nameCn === name);
      const preferred =
        matches.find((teacher) => teacher.departmentId == null) ?? matches[0];
      if (preferred) {
        state.teacherIdByName.set(name, preferred.id);
      }
    }
  });

  const missing = unresolved.filter((name) => !state.teacherIdByName.has(name));
  if (missing.length > 0) {
    await db.teacher.createMany({
      data: missing.map((nameCn) => ({ nameCn, departmentId: null })),
    });
  }

  await forEachChunk(unresolved, SQLITE_READ_BATCH_SIZE, async (batch) => {
    const resolved = await db.teacher.findMany({
      where: { nameCn: { in: batch } },
      select: { id: true, nameCn: true, departmentId: true },
      orderBy: { id: "asc" },
    });
    for (const name of batch) {
      const matches = resolved.filter((teacher) => teacher.nameCn === name);
      const preferred =
        matches.find((teacher) => teacher.departmentId == null) ?? matches[0];
      if (preferred) {
        state.teacherIdByName.set(name, preferred.id);
      }
    }
  });
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

async function executeJsonbBatch<T>(
  db: ImportDbClient,
  rows: T[],
  sql: string,
  batchSize = DB_WRITE_BATCH_SIZE,
) {
  if (rows.length === 0) {
    return;
  }

  await forEachChunk(rows, batchSize, async (batch) => {
    await db.$executeRawUnsafe(sql, JSON.stringify(batch));
  });
}

const UPSERT_COURSES_SQL = `
      INSERT INTO "Course" (
        "jwId",
        "code",
        "nameCn",
        "nameEn",
        "categoryId",
        "classTypeId",
        "educationLevelId",
        "gradationId",
        "typeId"
      )
      SELECT
        x."jwId",
        x."code",
        x."nameCn",
        NULL,
        x."categoryId",
        x."classTypeId",
        x."educationLevelId",
        x."gradationId",
        x."typeId"
      FROM jsonb_to_recordset($1::jsonb) AS x(
        "jwId" int,
        "code" text,
        "nameCn" text,
        "typeId" int,
        "gradationId" int,
        "categoryId" int,
        "educationLevelId" int,
        "classTypeId" int
      )
      ON CONFLICT ("jwId") DO UPDATE SET
        "code" = EXCLUDED."code",
        "nameCn" = EXCLUDED."nameCn",
        "nameEn" = NULL,
        "categoryId" = EXCLUDED."categoryId",
        "classTypeId" = EXCLUDED."classTypeId",
        "educationLevelId" = EXCLUDED."educationLevelId",
        "gradationId" = EXCLUDED."gradationId",
        "typeId" = EXCLUDED."typeId"
      `;

async function upsertCourses(db: ImportDbClient, rows: CourseImportRow[]) {
  await executeJsonbBatch(db, rows, UPSERT_COURSES_SQL);
}

const UPSERT_SECTIONS_SQL = `
      INSERT INTO "Section" (
        "jwId",
        "code",
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
        "scheduleState",
        "remark",
        "courseId",
        "semesterId",
        "openDepartmentId"
      )
      SELECT
        x."jwId",
        x."code",
        x."credits",
        x."period",
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        x."dateTimePlaceText",
        x."dateTimePlacePersonText",
        x."actualPeriods",
        x."scheduleState",
        x."remark",
        x."courseId",
        x."semesterId",
        x."openDepartmentId"
      FROM jsonb_to_recordset($1::jsonb) AS x(
        "jwId" int,
        "code" text,
        "credits" double precision,
        "period" int,
        "dateTimePlaceText" text,
        "dateTimePlacePersonText" jsonb,
        "actualPeriods" int,
        "scheduleState" text,
        "remark" text,
        "courseId" int,
        "semesterId" int,
        "openDepartmentId" int
      )
      ON CONFLICT ("jwId") DO UPDATE SET
        "code" = EXCLUDED."code",
        "credits" = EXCLUDED."credits",
        "period" = EXCLUDED."period",
        "periodsPerWeek" = NULL,
        "timesPerWeek" = NULL,
        "stdCount" = NULL,
        "limitCount" = NULL,
        "graduateAndPostgraduate" = NULL,
        "dateTimePlaceText" = EXCLUDED."dateTimePlaceText",
        "dateTimePlacePersonText" = EXCLUDED."dateTimePlacePersonText",
        "actualPeriods" = EXCLUDED."actualPeriods",
        "scheduleState" = EXCLUDED."scheduleState",
        "remark" = EXCLUDED."remark",
        "courseId" = EXCLUDED."courseId",
        "semesterId" = EXCLUDED."semesterId",
        "openDepartmentId" = EXCLUDED."openDepartmentId"
      `;

async function upsertSections(db: ImportDbClient, rows: SectionImportRow[]) {
  await executeJsonbBatch(db, rows, UPSERT_SECTIONS_SQL);
}

async function loadCourseIds(db: ImportDbClient, jwIds: number[]) {
  const rows: Array<{ id: number; jwId: number }> = [];
  await forEachChunk(jwIds, SQLITE_READ_BATCH_SIZE, async (batch) => {
    rows.push(
      ...(await db.course.findMany({
        where: { jwId: { in: batch } },
        select: { id: true, jwId: true },
      })),
    );
  });
  return new Map(rows.map((row) => [row.jwId, row.id]));
}

async function loadSectionIds(db: ImportDbClient, jwIds: number[]) {
  const rows: Array<{ id: number; jwId: number }> = [];
  await forEachChunk(jwIds, SQLITE_READ_BATCH_SIZE, async (batch) => {
    rows.push(
      ...(await db.section.findMany({
        where: { jwId: { in: batch } },
        select: { id: true, jwId: true },
      })),
    );
  });
  return new Map(rows.map((row) => [row.jwId, row.id]));
}

const DELETE_SECTION_TEACHERS_SQL = `
      DELETE FROM "_SectionTeachers"
      WHERE "A" IN (
        SELECT x."id"
        FROM jsonb_to_recordset($1::jsonb) AS x("id" int)
      )
      `;

const INSERT_SECTION_TEACHERS_SQL = `
      INSERT INTO "_SectionTeachers" ("A", "B")
      SELECT x."sectionId", x."teacherId"
      FROM jsonb_to_recordset($1::jsonb) AS x(
        "sectionId" int,
        "teacherId" int
      )
      ON CONFLICT DO NOTHING
      `;

async function replaceSectionTeachers(
  db: ImportDbClient,
  sectionIds: number[],
  links: Array<{ sectionId: number; teacherId: number }>,
) {
  await executeJsonbBatch(
    db,
    sectionIds.map((id) => ({ id })),
    DELETE_SECTION_TEACHERS_SQL,
    SQLITE_READ_BATCH_SIZE,
  );
  await executeJsonbBatch(
    db,
    links,
    INSERT_SECTION_TEACHERS_SQL,
    JOIN_WRITE_BATCH_SIZE,
  );
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

const INSERT_SCHEDULE_TEACHERS_SQL = `
      INSERT INTO "_ScheduleTeachers" ("A", "B")
      SELECT x."scheduleId", x."teacherId"
      FROM jsonb_to_recordset($1::jsonb) AS x(
        "scheduleId" int,
        "teacherId" int
      )
      ON CONFLICT DO NOTHING
      `;

async function insertScheduleTeachers(
  db: ImportDbClient,
  links: Array<{ scheduleId: number; teacherId: number }>,
) {
  await executeJsonbBatch(
    db,
    links,
    INSERT_SCHEDULE_TEACHERS_SQL,
    JOIN_WRITE_BATCH_SIZE,
  );
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

function collectTeacherNames(
  courses: SnapshotCourse[],
  lecturesByCourse: Map<number, SnapshotLecture[]>,
) {
  return courses.flatMap((course) => [
    ...splitNames(course.teacher_name),
    ...(lecturesByCourse.get(course.id) ?? []).flatMap((lecture) =>
      splitNames(lecture.teacher_name),
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
    collectTeacherNames(courses, lecturesByCourse),
  );
}

async function importSemesterCourses(
  db: ImportDbClient,
  semester: SnapshotSemester,
  courses: SnapshotCourse[],
  lecturesByCourse: Map<number, SnapshotLecture[]>,
  examsByCourse: Map<number, SnapshotExam[]>,
  state: ImportLookupState,
  scheduleGroupJwIdByCourse: Map<number, number>,
) {
  const semesterRecord = await measure(
    `Upsert semester ${semester.id}`,
    async () => upsertSemester(db, semester),
  );

  await measure(`Resolve lookup tables for semester ${semester.id}`, async () =>
    resolveSemesterLookups(db, state, courses, lecturesByCourse),
  );

  const courseRows = dedupeByJwId(
    courses.map((course) => ({
      jwId: stableNumericId("course", course.course_code),
      code: course.course_code,
      nameCn: course.name,
      typeId: course.course_type
        ? (state.courseTypeIdByName.get(course.course_type) ?? null)
        : null,
      gradationId:
        state.courseGradationIdByName.get(course.course_gradation) ?? null,
      categoryId:
        state.courseCategoryIdByName.get(course.course_category) ?? null,
      educationLevelId:
        state.educationLevelIdByName.get(course.education_type) ?? null,
      classTypeId: state.classTypeIdByName.get(course.class_type) ?? null,
    })),
  );

  await measure(`Upsert courses for semester ${semester.id}`, async () => {
    await upsertCourses(db, courseRows);
  });
  const courseIdByJwId = await measure(
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
    const courseId = courseIdByJwId.get(
      stableNumericId("course", course.course_code),
    );
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

  await measure(`Upsert sections for semester ${semester.id}`, async () => {
    await upsertSections(db, sectionRows);
  });
  const sectionIdByJwId = await measure(
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
    return splitNames(course.teacher_name)
      .map((name) => state.teacherIdByName.get(name))
      .filter((teacherId): teacherId is number => teacherId != null)
      .map((teacherId) => ({ sectionId, teacherId }));
  });

  const sectionIds = [...sectionIdByJwId.values()];
  await measure(
    `Replace section teachers for semester ${semester.id}`,
    async () => {
      await replaceSectionTeachers(db, sectionIds, sectionTeacherLinks);
    },
  );
  await measure(
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
      const teacherIds = splitNames(lecture.teacher_name)
        .map((name) => state.teacherIdByName.get(name))
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
      examRows.push({
        jwId: examJwIdForCourse(course.id, position),
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

  await measure(`Create schedules for semester ${semester.id}`, async () => {
    await createSchedules(db, normalizedScheduleRows);
  });
  await measure(`Create exams for semester ${semester.id}`, async () => {
    await createExams(db, examRows);
  });

  logger.info(
    `Semester ${semester.id} imported: courses=${courses.length}, lectures=${scheduleRows.length}, exams=${examRows.length}`,
  );
}

async function importCourses(
  snapshot: StaticSnapshot,
  minSemesterCode: number,
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
  const scheduleGroupJwIdByCourse = buildScheduleGroupJwIdByCourse(
    [...coursesBySemesterId.values()].flat(),
  );
  const state = createImportLookupState();

  logger.info(
    `Filtered to ${semesters.length} semesters (code >= ${minSemesterCode})`,
  );

  for (const semester of semesters) {
    logger.info(`Processing semester: ${semester.name} (${semester.id})`);

    const courses = coursesBySemesterId.get(semester.id) ?? [];
    const lecturesByCourse = await measure(
      `Load lectures for semester ${semester.id}`,
      async () =>
        groupByCourseId(snapshot.listLecturesForSemester(semester.id)),
    );
    const examsByCourse = await measure(
      `Load exams for semester ${semester.id}`,
      async () => groupByCourseId(snapshot.listExamsForSemester(semester.id)),
    );

    await prisma.$transaction(async (db) => {
      await importSemesterCourses(
        db,
        semester,
        courses,
        lecturesByCourse,
        examsByCourse,
        state,
        scheduleGroupJwIdByCourse,
      );
    });
  }
}

function buildBusPayload(snapshot: StaticSnapshot): BusStaticPayload {
  const campuses = snapshot.listBusCampuses();
  const campusMap = new Map<number, BusStaticCampus>(
    campuses.map((campus) => [
      campus.id,
      {
        id: campus.id,
        name: campus.name,
        latitude: campus.latitude,
        longitude: campus.longitude,
      },
    ]),
  );

  const routeStops = snapshot.listBusRouteStops();
  const routeMap = new Map<number, BusStaticRoute>();
  const stopsByRouteId = new Map<number, SnapshotBusRouteStop[]>();

  for (const stop of routeStops) {
    const stops = stopsByRouteId.get(stop.route_id);
    if (stops) {
      stops.push(stop);
    } else {
      stopsByRouteId.set(stop.route_id, [stop]);
    }
  }

  for (const route of snapshot.listBusRoutes()) {
    routeMap.set(route.id, {
      id: route.id,
      campuses: (stopsByRouteId.get(route.id) ?? [])
        .sort((left, right) => left.stop_order - right.stop_order)
        .map((stop) => {
          const campus = campusMap.get(stop.campus_id);
          if (!campus) {
            throw new Error(`Unknown bus campus id ${stop.campus_id}`);
          }
          return campus;
        }),
    });
  }

  const buildSchedules = (dayType: "weekday" | "weekend") => {
    const stopTimes = snapshot.listBusTripStopTimes(dayType);
    const groupedTrips = new Map<string, BusStaticRouteSchedule>();
    const stopTimesByTrip = new Map<string, SnapshotBusTripStopTime[]>();

    for (const stopTime of stopTimes) {
      const key = `${stopTime.schedule_id}:${stopTime.position}`;
      const times = stopTimesByTrip.get(key);
      if (times) {
        times.push(stopTime);
      } else {
        stopTimesByTrip.set(key, [stopTime]);
      }
    }

    for (const trip of snapshot.listBusTrips(dayType)) {
      const route = routeMap.get(trip.route_id);
      if (!route) {
        throw new Error(`Unknown bus route id ${trip.route_id}`);
      }

      const key = `${trip.schedule_id}`;
      let schedule = groupedTrips.get(key);
      if (!schedule) {
        schedule = {
          id: trip.schedule_id,
          route,
          time: [],
        };
        groupedTrips.set(key, schedule);
      }

      schedule.time[trip.position] = (
        stopTimesByTrip.get(`${trip.schedule_id}:${trip.position}`) ?? []
      )
        .sort((left, right) => left.stop_order - right.stop_order)
        .map((stopTime) => stopTime.departure_time);
    }

    return [...groupedTrips.values()].sort((left, right) => left.id - right.id);
  };

  const notice = snapshot.getBusNotice();

  return {
    campuses: [...campusMap.values()].sort((left, right) => left.id - right.id),
    routes: [...routeMap.values()].sort((left, right) => left.id - right.id),
    weekday_routes: buildSchedules("weekday"),
    weekend_routes: buildSchedules("weekend"),
    message: {
      message: notice?.message ?? "",
      url: notice?.url ?? "",
    },
  };
}

async function loadBusData(snapshot: StaticSnapshot) {
  logger.info("Loading bus data...");
  const payload = buildBusPayload(snapshot);

  const result = await importBusStaticPayload(prisma, payload, {
    versionKey: "static-bus-structured",
    versionTitle: "Static Structured Bus Timetable",
    effectiveFrom: null,
    effectiveUntil: null,
  });

  logger.info(
    `Imported bus data: version=${result.versionKey}, campuses=${result.campuses}, routes=${result.routes}, trips=${result.trips}`,
  );
}

async function main() {
  try {
    logger.info(`Starting data load (min semester code: ${minSemesterJwId})`);
    logger.info("Downloading static snapshot...");
    const snapshotPath = await downloadStaticSnapshot(cacheDir);
    const snapshot = new StaticSnapshot(snapshotPath);
    logger.info(`Static snapshot at: ${snapshotPath}`);

    try {
      snapshot.assertSupportedSchema();
      const generatedAt = snapshot.getMetadata("generated_at");
      if (generatedAt) {
        logger.info(`Snapshot generated at: ${generatedAt}`);
      }

      if (!args["skip-courses"]) {
        await importCourses(snapshot, minSemesterJwId);
      } else {
        logger.info("Skipping course data (--skip-courses)");
      }

      if (!args["skip-bus"]) {
        await loadBusData(snapshot);
      } else {
        logger.info("Skipping bus data (--skip-bus)");
      }
    } finally {
      snapshot.close();
    }

    logger.info("All data load complete!");
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Fatal error: ${err.message}`);
    if (err.stack) {
      logger.error(`Stack trace: ${err.stack}`);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
