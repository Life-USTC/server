import type {
  Prisma,
  PrismaClient,
} from "../../src/generated/prisma-node/client";
import type { StaticCourseImportRow } from "./static-course-import-helpers";
import {
  DB_WRITE_BATCH_SIZE,
  forEachChunk,
  JOIN_WRITE_BATCH_SIZE,
  SQLITE_READ_BATCH_SIZE,
} from "./static-loader-batches";

export type ImportDbClient = PrismaClient | Prisma.TransactionClient;

export type SectionImportRow = {
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

export type ScheduleGroupImportRow = {
  jwId: number;
  sectionId: number;
  no: number;
  limitCount: number;
  stdCount: number;
  actualPeriods: number;
  isDefault: boolean;
};

export type ScheduleImportRow = {
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

export type ExamImportRow = {
  jwId: number;
  sectionId: number;
  examType: number | null;
  startTime: number | null;
  endTime: number | null;
  examDate: Date | null;
  examMode: string | null;
  rooms: string[];
};

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
    // SQL is module-owned static text; only row data is dynamic and bound as JSON.
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
        "classifyId",
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
        x."classifyId",
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
        "classTypeId" int,
        "classifyId" int
      )
      ON CONFLICT ("jwId") DO UPDATE SET
        "code" = EXCLUDED."code",
        "nameCn" = EXCLUDED."nameCn",
        "nameEn" = NULL,
        "categoryId" = EXCLUDED."categoryId",
        "classTypeId" = EXCLUDED."classTypeId",
        "classifyId" = EXCLUDED."classifyId",
        "educationLevelId" = EXCLUDED."educationLevelId",
        "gradationId" = EXCLUDED."gradationId",
        "typeId" = EXCLUDED."typeId"
      `;

export async function upsertCourses(
  db: ImportDbClient,
  rows: StaticCourseImportRow[],
) {
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
        "dateTimePlaceText" = EXCLUDED."dateTimePlaceText",
        "dateTimePlacePersonText" = EXCLUDED."dateTimePlacePersonText",
        "actualPeriods" = EXCLUDED."actualPeriods",
        "scheduleState" = EXCLUDED."scheduleState",
        "remark" = EXCLUDED."remark",
        "courseId" = EXCLUDED."courseId",
        "semesterId" = EXCLUDED."semesterId",
        "openDepartmentId" = EXCLUDED."openDepartmentId"
      `;

export async function upsertSections(
  db: ImportDbClient,
  rows: SectionImportRow[],
) {
  await executeJsonbBatch(db, rows, UPSERT_SECTIONS_SQL);
}

export async function loadCourseIds(db: ImportDbClient, jwIds: number[]) {
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

export async function loadSectionIds(db: ImportDbClient, jwIds: number[]) {
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

const RETIRE_STALE_SECTION_TEACHER_TARGETS_SQL = `
      UPDATE "SectionTeacher" AS st
      SET
        "retiredAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE st."sectionId" IN (
        SELECT x."id"
        FROM jsonb_to_recordset($1::jsonb) AS x("id" int)
      )
        AND st."retiredAt" IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM jsonb_to_recordset($2::jsonb) AS links(
            "sectionId" int,
            "teacherId" int
          )
          WHERE links."sectionId" = st."sectionId"
            AND links."teacherId" = st."teacherId"
        )
      `;

const UPSERT_SECTION_TEACHER_TARGETS_SQL = `
      INSERT INTO "SectionTeacher" (
        "sectionId",
        "teacherId",
        "retiredAt",
        "updatedAt"
      )
      SELECT
        x."sectionId",
        x."teacherId",
        NULL,
        CURRENT_TIMESTAMP
      FROM jsonb_to_recordset($1::jsonb) AS x(
        "sectionId" int,
        "teacherId" int
      )
      ON CONFLICT ("sectionId", "teacherId") DO UPDATE SET
        "retiredAt" = NULL,
        "updatedAt" = CURRENT_TIMESTAMP
      `;

async function syncSectionTeacherTargets(
  db: ImportDbClient,
  sectionIds: number[],
  links: Array<{ sectionId: number; teacherId: number }>,
) {
  const linksBySectionId = new Map<
    number,
    Array<{ sectionId: number; teacherId: number }>
  >();
  for (const link of links) {
    const sectionLinks = linksBySectionId.get(link.sectionId);
    if (sectionLinks) {
      sectionLinks.push(link);
    } else {
      linksBySectionId.set(link.sectionId, [link]);
    }
  }

  await forEachChunk(sectionIds, SQLITE_READ_BATCH_SIZE, async (batch) => {
    const batchLinks = batch.flatMap(
      (sectionId) => linksBySectionId.get(sectionId) ?? [],
    );
    await db.$executeRawUnsafe(
      RETIRE_STALE_SECTION_TEACHER_TARGETS_SQL,
      JSON.stringify(batch.map((id) => ({ id }))),
      JSON.stringify(batchLinks),
    );
    await executeJsonbBatch(
      db,
      batchLinks,
      UPSERT_SECTION_TEACHER_TARGETS_SQL,
      JOIN_WRITE_BATCH_SIZE,
    );
  });
}

export async function replaceSectionTeachers(
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
  await syncSectionTeacherTargets(db, sectionIds, links);
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

export async function insertScheduleTeachers(
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
